import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-key-please-change'
    UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max upload

    # Session cookie flags. SESSION_COOKIE_SECURE stays True for gunicorn
    # (production, HTTPS at Railway's proxy). app.py turns it off when
    # Flask debug is on so http://localhost still keeps the login session.
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_HTTPONLY = True

