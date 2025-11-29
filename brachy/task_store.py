import json
import os
import fcntl
from datetime import datetime

TASKS_FILE = os.path.join(os.getcwd(), 'data', 'tasks.json')

def ensure_data_dir():
    """Ensure data directory exists"""
    data_dir = os.path.dirname(TASKS_FILE)
    os.makedirs(data_dir, exist_ok=True)

def load_tasks():
    """Load all tasks from JSON file with file locking"""
    ensure_data_dir()
    
    if not os.path.exists(TASKS_FILE):
        return []
    
    try:
        with open(TASKS_FILE, 'r') as f:
            fcntl.flock(f.fileno(), fcntl.LOCK_SH)  # Shared lock for reading
            try:
                data = json.load(f)
                return data if isinstance(data, list) else []
            finally:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error loading tasks: {e}")
        return []

def save_tasks(tasks):
    """Save tasks to JSON file with file locking"""
    ensure_data_dir()
    
    # Write to temp file first, then rename (atomic operation)
    temp_file = TASKS_FILE + '.tmp'
    
    try:
        with open(temp_file, 'w') as f:
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)  # Exclusive lock for writing
            try:
                json.dump(tasks, f, indent=2, default=str)
                f.flush()
                os.fsync(f.fileno())
            finally:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
        
        # Atomic rename
        os.replace(temp_file, TASKS_FILE)
        return True
    except (IOError, OSError) as e:
        print(f"Error saving tasks: {e}")
        if os.path.exists(temp_file):
            os.remove(temp_file)
        return False

def get_task(task_id):
    """Get a single task by ID"""
    tasks = load_tasks()
    for task in tasks:
        if task.get('id') == task_id:
            return task
    return None

def add_task(task):
    """Add a new task to storage"""
    tasks = load_tasks()
    tasks.append(task)
    return save_tasks(tasks)

def update_task(task_id, updated_task):
    """Update an existing task"""
    tasks = load_tasks()
    for i, task in enumerate(tasks):
        if task.get('id') == task_id:
            tasks[i] = updated_task
            return save_tasks(tasks)
    return False

def delete_task(task_id):
    """Delete a task by ID"""
    tasks = load_tasks()
    tasks = [t for t in tasks if t.get('id') != task_id]
    return save_tasks(tasks)

