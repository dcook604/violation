from flask import Blueprint, redirect, url_for, flash, request, jsonify, current_app
from flask_jwt_extended import get_jwt, get_jwt_identity
from app.jwt_auth import jwt_required_api
from .models import User, FieldDefinition, Settings
from . import db
from werkzeug.security import generate_password_hash
import json
from .utils import clear_field_cache

admin_bp = Blueprint('admin', __name__)

# Decorator to restrict access to admin users
def admin_required(f):
    def decorated_function(*args, **kwargs):
        claims = get_jwt()
        is_admin = claims.get('is_admin')
        user_id = get_jwt_identity()
        if not is_admin:
            return jsonify({"error": "Admin privileges required"}), 403
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

# Removed old user management routes as they are now handled in user_routes.py

@admin_bp.route('/api/fields', methods=['GET'])
@admin_required
def list_fields():
    fields = FieldDefinition.query.order_by(FieldDefinition.order).all()
    return jsonify([{
        'id': f.id,
        'name': f.name,
        'label': f.label,
        'type': f.type,
        'required': f.required,
        'options': f.options,
        'order': f.order,
        'active': f.active,
        'validation': f.validation,
        'grid_column': f.grid_column
    } for f in fields])

@admin_bp.route('/api/fields', methods=['POST'])
@admin_required
def create_field():
    data = request.get_json()
    field = FieldDefinition(
        name=data['name'],
        label=data.get('label', data['name']),
        type=data['type'],
        required=data.get('required', False),
        options=data.get('options'),
        order=data.get('order', 0),
        active=data.get('active', True),
        validation=data.get('validation'),
        grid_column=data.get('grid_column', 0)
    )
    db.session.add(field)
    db.session.commit()
    
    # Clear field cache after creating a new field
    clear_field_cache()
    
    return jsonify({'message': 'Field created', 'id': field.id}), 201

@admin_bp.route('/api/fields/<int:fid>', methods=['PUT'])
@admin_required
def update_field(fid):
    field = FieldDefinition.query.get_or_404(fid)
    data = request.get_json()
    field.label = data.get('label', field.label)
    field.type = data.get('type', field.type)
    field.required = data.get('required', field.required)
    field.options = data.get('options', field.options)
    field.order = data.get('order', field.order)
    field.active = data.get('active', field.active)
    field.validation = data.get('validation', field.validation)
    field.grid_column = data.get('grid_column', field.grid_column)
    db.session.commit()
    
    # Clear field cache after updating a field
    clear_field_cache()
    
    return jsonify({'message': 'Field updated'})

@admin_bp.route('/api/fields/<int:fid>', methods=['DELETE'])
@admin_required
def delete_field(fid):
    field = FieldDefinition.query.get_or_404(fid)
    db.session.delete(field)
    db.session.commit()
    
    # Clear field cache after deleting a field
    clear_field_cache()
    
    return jsonify({'message': 'Field deleted'})

@admin_bp.route('/api/fields/<int:fid>/toggle', methods=['POST'])
@admin_required
def toggle_field(fid):
    field = FieldDefinition.query.get_or_404(fid)
    field.active = not field.active
    db.session.commit()
    
    # Clear field cache after toggling a field
    clear_field_cache()
    
    return jsonify({'message': 'Field toggled', 'active': field.active})

@admin_bp.route('/api/fields/reorder', methods=['POST'])
@admin_required
def reorder_fields():
    data = request.get_json()
    for idx, fid in enumerate(data['order']):
        field = FieldDefinition.query.get(fid)
        if field:
            field.order = idx
    db.session.commit()
    
    # Clear field cache after reordering fields
    clear_field_cache()
    
    return jsonify({'message': 'Fields reordered'})

@admin_bp.route('/api/admin/settings/test-email', methods=['POST'])
@admin_required
def test_email():
    """Send a test email using the current environment SMTP settings"""
    from .utils import send_email
    import traceback
    
    data = request.json or {}
    recipient = data.get('email') or get_jwt().get('email')
    
    if not recipient:
        return jsonify({'error': 'No recipient email provided'}), 400
    
    # Removed: Get settings from database
    # settings = Settings.get_settings()
    
    # Log the SMTP configuration being used (from app.config / .env)
    current_app.logger.info(f"Test email requested. Using App Config SMTP settings:")
    current_app.logger.info(f"Server: {current_app.config.get('MAIL_SERVER')}")
    current_app.logger.info(f"Port: {current_app.config.get('MAIL_PORT')}")
    current_app.logger.info(f"Username: {current_app.config.get('MAIL_USERNAME')}")
    current_app.logger.info(f"TLS Enabled: {current_app.config.get('MAIL_USE_TLS')}")
    current_app.logger.info(f"Password: {'Set' if current_app.config.get('MAIL_PASSWORD') else 'Not set'}")
    current_app.logger.info(f"Default Sender: {current_app.config.get('MAIL_DEFAULT_SENDER')}")
    
    try:
        # send_email now uses the app config directly
        send_email(
            subject="Test Email from Violation System",
            recipients=[recipient],
            body="This is a test email from the Violation System to verify that email sending is properly configured.",
            html="<p>This is a test email from the Violation System to verify that email sending is properly configured.</p>"
        )
        return jsonify({'message': f'Test email sent to {recipient}'})
    except Exception as e:
        error_msg = str(e)
        stack_trace = traceback.format_exc()
        current_app.logger.error(f"Error sending test email: {error_msg}")
        current_app.logger.error(f"Stack trace: {stack_trace}")
        
        # Check for common errors and provide helpful responses (This logic remains useful)
        if "Connection refused" in error_msg:
            detailed_msg = (
                "Connection refused error. Possible causes:\n"
                "1. SMTP server address or port may be incorrect\n"
                "2. Firewall may be blocking outgoing connections\n"
                "3. SMTP server may be down or not accepting connections\n"
                f"Error details: {error_msg}"
            )
        elif "Authentication" in error_msg or "credential" in error_msg.lower():
            detailed_msg = (
                "Authentication error. Possible causes:\n"
                "1. Username or password may be incorrect\n"
                "2. Account may require specific security settings\n"
                f"Error details: {error_msg}"
            )
        # Add check for missing configuration based on ValueError from send_email
        elif isinstance(e, ValueError) and "Missing essential SMTP configuration" in error_msg:
            detailed_msg = f"Email sending failed: {error_msg}. Please configure required MAIL_* environment variables."
        else:
            detailed_msg = f"Failed to send test email: {error_msg}"
            
        return jsonify({'error': detailed_msg}), 500
