import os
from dotenv import load_dotenv
from datetime import timedelta

basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(os.path.dirname(basedir), '.env'))

class Config:
    # Base configuration
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'development-key-change-me'
    BASE_DIR = os.path.dirname(basedir)
    BASE_URL = os.environ.get('BASE_URL') or 'http://172.16.16.6:5004'
    
    # Database settings
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(BASE_DIR, 'app.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Email settings
    MAIL_SERVER = os.environ.get('MAIL_SERVER') or 'localhost'
    MAIL_PORT = int(os.environ.get('MAIL_PORT') or 25)
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS') is not None
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER') or 'noreply@example.com'
    
    # Upload folder
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB limit for uploads
    
    # SSL redirect
    SSL_REDIRECT = False
    
    # Session and Cookie Settings
    SESSION_COOKIE_SECURE = False  # Set to True in production with HTTPS
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'  # Changed from None to Lax
    REMEMBER_COOKIE_SAMESITE = 'Lax'  # Changed from None to Lax
    SESSION_COOKIE_DOMAIN = None  # Allow cookies to work across subdomains
    REMEMBER_COOKIE_DOMAIN = None  # Allow remember cookies to work across subdomains
    SESSION_PROTECTION = 'strong'
    
    # Session timeout settings (absolute timeout: 24 hours)
    PERMANENT_SESSION_LIFETIME = timedelta(hours=24)
    
    # Custom application settings
    # Idle timeout in minutes (user will be logged out after this period of inactivity)
    IDLE_TIMEOUT_MINUTES = 30
    # Whether to enforce single session per user
    ENFORCE_SINGLE_SESSION = True