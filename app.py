import os
import csv
from io import BytesIO
from flask import Flask, render_template, request, redirect, url_for, flash, send_file, jsonify
from flask_login import LoginManager, login_user, login_required, logout_user, current_user
from flask_wtf.csrf import CSRFProtect
from werkzeug.security import check_password_hash
from werkzeug.utils import secure_filename
from xhtml2pdf import pisa
from PIL import Image
from config import Config

# Try to import pillow-heif for HEIC support
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
    HEIC_SUPPORT = True
except ImportError:
    HEIC_SUPPORT = False
    print("Warning: pillow-heif not installed. HEIC images will not be supported.")

# Initialize Flask app
app = Flask(__name__)
app.config.from_object(Config)
csrf = CSRFProtect(app)

# Initialize LoginManager
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Import auth functions (we will create this next)
from brachy.auth import load_users, User

@login_manager.user_loader
def load_user(user_id):
    users = load_users()
    if user_id in users:
        return User(user_id)
    return None

@app.route('/')
@login_required
def index():
    return render_template('base.html') # Placeholder until we have content

@app.route('/eye-plaque')
@login_required
def eye_plaque():
    return render_template('eye_plaque.html', current_user_id=current_user.id)

@app.route('/prostate')
@login_required
def prostate():
    return render_template('prostate.html')

@app.route('/gynecologic')
@login_required
def gynecologic():
    return render_template('gynecologic.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        users = load_users()
        
        if username in users and users[username] == password:
            user = User(username)
            login_user(user)
            return redirect(url_for('index'))
        else:
            flash('Invalid username or password')
            
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/upload', methods=['POST'])
@login_required
def upload_file():
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file part'})
    file = request.files['file']
    task_id = request.form.get('task_id')
    step_id = request.form.get('step_id')
    
    if file and task_id and step_id:
        filename = secure_filename(file.filename)
        save_dir = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(task_id), secure_filename(step_id))
        os.makedirs(save_dir, exist_ok=True)
        
        filepath = os.path.join(save_dir, filename)
        file.save(filepath)
        
        # Handle HEIC conversion
        if filename.lower().endswith(('.heic', '.heif')):
            if not HEIC_SUPPORT:
                return jsonify({'success': False, 'message': 'HEIC support not available. Please install pillow-heif.'})
            
            try:
                # Open HEIC and convert to JPEG
                img = Image.open(filepath)
                # Convert RGBA to RGB if necessary
                if img.mode == 'RGBA':
                    rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                    rgb_img.paste(img, mask=img.split()[3])
                    img = rgb_img
                elif img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Save as JPEG
                jpeg_filename = os.path.splitext(filename)[0] + '.jpg'
                jpeg_path = os.path.join(save_dir, jpeg_filename)
                img.save(jpeg_path, 'JPEG', quality=95)
                
                # Remove original HEIC file
                os.remove(filepath)
                filename = jpeg_filename
                filepath = jpeg_path
            except Exception as e:
                return jsonify({'success': False, 'message': f'Error converting HEIC: {str(e)}'})
        
        # Return path relative to static/uploads or absolute URL
        return jsonify({
            'success': True, 
            'filename': filename, 
            'path': f'/uploads/{task_id}/{step_id}/{filename}'
        })
    return jsonify({'success': False, 'message': 'Invalid data'})

@app.route('/export-pdf', methods=['POST'])
@login_required
def export_pdf():
    import base64
    
    data = request.json
    if not data:
        return jsonify({'success': False, 'message': 'No data provided'}), 400
    
    # Convert images to base64 for PDF embedding
    if 'uploads' in data:
        for step_id, files in data['uploads'].items():
            for file_info in files:
                if 'path' in file_info:
                    # Convert /uploads/... to absolute file path
                    rel_path = file_info['path'].lstrip('/')
                    abs_path = os.path.join(os.getcwd(), rel_path)
                    if os.path.exists(abs_path):
                        try:
                            # Read image and convert to base64
                            with open(abs_path, 'rb') as img_file:
                                img_data = img_file.read()
                                img_base64 = base64.b64encode(img_data).decode('utf-8')
                                
                                # Determine MIME type from file extension
                                ext = os.path.splitext(abs_path)[1].lower()
                                mime_types = {
                                    '.jpg': 'image/jpeg',
                                    '.jpeg': 'image/jpeg',
                                    '.png': 'image/png',
                                    '.gif': 'image/gif',
                                    '.heic': 'image/jpeg',  # Already converted
                                    '.heif': 'image/jpeg'
                                }
                                mime_type = mime_types.get(ext, 'image/jpeg')
                                
                                file_info['base64'] = img_base64
                                file_info['mime_type'] = mime_type
                        except Exception as e:
                            print(f"Error encoding image {abs_path}: {e}")
                            file_info['base64'] = None
        
    # Render a template 'pdf_report.html' with this data
    rendered = render_template('pdf_report.html', task=data, current_user=current_user, base_url=request.url_root)
    
    pdf_file = BytesIO()
    pisa_status = pisa.CreatePDF(rendered, dest=pdf_file)
    
    if pisa_status.err:
        return jsonify({'success': False, 'message': 'PDF generation error'}), 500
        
    pdf_file.seek(0)
    return send_file(
        pdf_file, 
        as_attachment=True, 
        download_name=f"report_{data.get('id', 'task')}.pdf", 
        mimetype='application/pdf'
    )

# Task API routes
from brachy.task_store import load_tasks, get_task, add_task, delete_task

@app.route('/api/tasks', methods=['GET'])
@login_required
def api_get_tasks():
    """Get all tasks"""
    try:
        tasks = load_tasks()
        return jsonify({'success': True, 'tasks': tasks})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/tasks/<task_id>', methods=['GET'])
@login_required
def api_get_task(task_id):
    """Get a single task"""
    try:
        task = get_task(task_id)
        if task:
            return jsonify({'success': True, 'task': task})
        else:
            return jsonify({'success': False, 'message': 'Task not found'}), 404
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/tasks', methods=['POST'])
@login_required
def api_create_task():
    """Create/save a new task"""
    try:
        task = request.json
        if not task or 'id' not in task:
            return jsonify({'success': False, 'message': 'Invalid task data'}), 400
        
        # Ensure user is set
        task['user'] = current_user.id
        
        # Add to storage
        if add_task(task):
            return jsonify({'success': True, 'message': 'Task saved'})
        else:
            return jsonify({'success': False, 'message': 'Failed to save task'}), 500
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/tasks/<task_id>', methods=['DELETE'])
@login_required
def api_delete_task(task_id):
    """Delete a task"""
    try:
        task = get_task(task_id)
        if not task:
            return jsonify({'success': False, 'message': 'Task not found'}), 404
        
        # Only allow deletion by task owner
        if task.get('user') != current_user.id:
            return jsonify({'success': False, 'message': 'Permission denied'}), 403
        
        if delete_task(task_id):
            return jsonify({'success': True, 'message': 'Task deleted'})
        else:
            return jsonify({'success': False, 'message': 'Failed to delete task'}), 500
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/verify-password', methods=['POST'])
@login_required
def api_verify_password():
    """Verify user password for override actions"""
    try:
        data = request.json
        password = data.get('password', '')
        
        users = load_users()
        if current_user.id in users and users[current_user.id] == password:
            return jsonify({'success': True})
        else:
            return jsonify({'success': False, 'message': 'Invalid password'}), 401
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# Serve uploaded files
@app.route('/uploads/<path:filename>')
@login_required
def uploaded_file(filename):
    """Serve uploaded files"""
    return send_file(os.path.join(app.config['UPLOAD_FOLDER'], filename))

if __name__ == '__main__':
    app.run(debug=True)

