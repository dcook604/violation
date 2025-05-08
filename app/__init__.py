import os
import logging
from flask import Flask, request, jsonify, render_template
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_mail import Mail
from flask_cors import CORS
from flask_migrate import Migrate
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from .config import config_by_name
from datetime import timedelta
from flask.sessions import SecureCookieSessionInterface
import os.path
from dotenv import load_dotenv

# Load environment variables from .env file
# Ensure this runs early, before create_app uses config
load_dotenv()

# Custom session interface to fix SameSite issue
class CustomSessionInterface(SecureCookieSessionInterface):
    def get_cookie_samesite(self, app):
        # Use SameSite=Strict in production if possible, else Lax
        return 'Strict' if app.config.get('SESSION_COOKIE_SECURE') else 'Lax'

# Configure logging to save errors to flask_error.log
logging.basicConfig(
    filename='flask_error.log',
    level=logging.INFO,  # Change from ERROR to INFO to capture more detailed logs
    format='%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
)

# Create a console handler to also show logs in the terminal
console = logging.StreamHandler()
console.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]')
console.setFormatter(formatter)
logging.getLogger('').addHandler(console)

db = SQLAlchemy()
login_manager = LoginManager()
mail = Mail()
migrate = Migrate()
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "200 per hour"],
    storage_uri="memory://",
    strategy="fixed-window"
)

@login_manager.user_loader
def load_user(user_id):
    from .models import User
    return User.query.get(int(user_id))

# Add custom unauthorized handler for API requests
@login_manager.unauthorized_handler
def unauthorized():
    # Log that the handler was triggered
    path = request.path if request and hasattr(request, 'path') else 'unknown'
    if os.environ.get('FLASK_ENV') == 'development':
        print(f"--- UNAUTHORIZED HANDLER TRIGGERED for {path} ---")
        print(f"Request method: {request.method}, Headers: {dict(request.headers)}")
        print(f"Cookies present: {bool(request.cookies)}")
    
    # Always return JSON
    return jsonify({
        'error': 'Unauthorized',
        'message': 'You must be logged in to access this resource',
        'path': path
    }), 401

# Custom Jinja2 filters
def basename_filter(path):
    return os.path.basename(path)

def nl2br_filter(text):
    if not text:
        return ""
    return text.replace('\n', '<br>')

def create_app(config_name=None):
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'default')
        
    app = Flask(__name__)
    app.config.from_object(config_by_name[config_name])
    
    # Ensure secret key is set
    if not app.config.get('SECRET_KEY'):
        if config_name == 'production':
            raise ValueError("SECRET_KEY must be set via environment variable in production!")
        else:
            app.logger.warning("Using default development SECRET_KEY. Set a proper SECRET_KEY environment variable.")
            app.config['SECRET_KEY'] = 'dev-key-please-change-in-production'

    # Register custom Jinja2 filters
    app.jinja_env.filters['basename'] = basename_filter
    app.jinja_env.filters['nl2br'] = nl2br_filter
    
    # Use custom session interface
    app.session_interface = CustomSessionInterface()
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    mail.init_app(app)
    limiter.init_app(app)
    
    # Initialize JWT
    from .jwt_config import init_jwt
    jwt = init_jwt(app)

    # Database connection error handler
    @app.errorhandler(Exception)
    def handle_db_exceptions(e):
        import sqlalchemy.exc
        from pymysql import MySQLError
        
        # Handle specific database-related exceptions
        if isinstance(e, (sqlalchemy.exc.OperationalError, 
                         sqlalchemy.exc.InternalError,
                         sqlalchemy.exc.DisconnectionError, 
                         MySQLError)):
            # Log detailed error for debugging
            app.logger.error(f"Database error: {str(e)}")
            
            # For API routes, return JSON error
            if request.path.startswith('/api/'):
                return jsonify({
                    'error': 'Database error',
                    'message': 'A database connection error occurred. Please try again later.'
                }), 500
            
            # For regular routes, show user-friendly error page
            return render_template('errors/db_error.html'), 500
            
        # Let Flask handle other exceptions normally
        return e

    # Conditional CORS Setup
    if app.config['DEBUG']:
        # Development CORS (more permissive)
        allowed_origins = ["http://localhost:3001", "http://localhost:3002", "http://172.16.16.6:3001", "http://172.16.16.6:5004", "http://100.75.244.2", "http://100.75.244.2:3001", "http://100.75.244.2:5004", "http://172.16.16.26", "http://172.16.16.26:3001"]
        CORS(app, 
             resources={r"/*": {
                 "origins": allowed_origins,
                 "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
                 "allow_headers": ["Content-Type", "Authorization", "X-Requested-With", "Accept", "X-CSRF-TOKEN", "X-CSRFToken", "x-csrf-token", "Expires", "Cache-Control", "Pragma"],
                 "supports_credentials": True,
                 "expose_headers": ["Content-Type", "Authorization", "X-CSRF-TOKEN"]
             }},
             supports_credentials=True)
        app.logger.info(f"Development CORS enabled for: {', '.join(allowed_origins)}")
    else:
        # Production CORS (restrictive)
        allowed_origins = [app.config.get('BASE_URL')] # Use BASE_URL from config
        if not allowed_origins[0]:
             raise ValueError("BASE_URL must be configured for production CORS.")
        CORS(app,
             resources={r"/api/*": { # Often only needed for /api/* routes
                 "origins": allowed_origins,
                 "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
                 "allow_headers": ["Content-Type", "Authorization", "X-Requested-With", "Accept", "X-CSRF-TOKEN", "X-CSRFToken", "x-csrf-token", "Expires", "Cache-Control", "Pragma"],
                 "supports_credentials": True,
                 "expose_headers": ["Content-Type", "Authorization", "X-CSRF-TOKEN"]
             }},
             supports_credentials=True)
        app.logger.info(f"Production CORS enabled for: {allowed_origins[0]}")

    from .auth_routes import auth as auth_blueprint
    from .routes import bp as main_blueprint
    from .admin_routes import admin_bp as admin_blueprint
    from .violation_routes import violation_bp as violations_blueprint
    from .user_routes import user_api as users_blueprint
    from .dashboard_routes import dashboard as dashboard_blueprint
    from .unit_routes import unit_bp as unit_blueprint
    from .test_jwt_routes import test_jwt_bp as test_jwt_blueprint

    app.register_blueprint(auth_blueprint)
    app.register_blueprint(main_blueprint)
    app.register_blueprint(admin_blueprint)
    app.register_blueprint(violations_blueprint)
    app.register_blueprint(users_blueprint)
    app.register_blueprint(dashboard_blueprint)
    app.register_blueprint(unit_blueprint)
    app.register_blueprint(test_jwt_blueprint)
    
    return app
