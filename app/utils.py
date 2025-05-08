import os
import uuid
import socket
from datetime import datetime
from flask import current_app, render_template, url_for, g
from werkzeug.utils import secure_filename
from flask_mail import Message
from . import mail
import json
from urllib.parse import urljoin
import time
import logging
from .models import Settings
import tempfile
from itsdangerous import URLSafeTimedSerializer

# Initialize logger
logger = logging.getLogger(__name__)

# Cache for field definitions
_field_cache = {
    'all': {'data': None, 'timestamp': 0},
    'active': {'data': None, 'timestamp': 0},
    'email': {'data': None, 'timestamp': 0}
}
# Cache expiration time in seconds (5 minutes)
CACHE_EXPIRATION = 300

def get_cached_fields(cache_key='all', filter_func=None, force_refresh=False):
    """
    Get cached field definitions or fetch from database if cache is expired
    
    Args:
        cache_key (str): Cache key to use ('all', 'active', 'email')
        filter_func (function): Optional filter function to apply to fields
        force_refresh (bool): Force a refresh of the cache
        
    Returns:
        list: Field definitions
    """
    from .models import FieldDefinition
    
    now = time.time()
    cache = _field_cache.get(cache_key, {'data': None, 'timestamp': 0})
    
    # If cache is expired or force refresh, fetch from database
    if force_refresh or not cache['data'] or (now - cache['timestamp'] > CACHE_EXPIRATION):
        if cache_key == 'active':
            fields = FieldDefinition.query.filter_by(active=True).order_by(FieldDefinition.order).all()
        elif cache_key == 'email':
            fields = FieldDefinition.query.filter_by(type='email').all()
        else:
            fields = FieldDefinition.query.order_by(FieldDefinition.order).all()
        
        # Apply custom filter if provided
        if filter_func:
            fields = list(filter(filter_func, fields))
        
        # Update cache
        _field_cache[cache_key] = {
            'data': fields,
            'timestamp': now
        }
        
    return _field_cache[cache_key]['data']

def clear_field_cache():
    """Clear all field definition caches"""
    global _field_cache
    _field_cache = {
        'all': {'data': None, 'timestamp': 0},
        'active': {'data': None, 'timestamp': 0},
        'email': {'data': None, 'timestamp': 0}
    }

def save_uploaded_file(file_storage, folder):
    filename = secure_filename(file_storage.filename)
    path = os.path.join(current_app.config['UPLOAD_FOLDER'], folder, filename)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    file_storage.save(path)
    return os.path.relpath(path, current_app.root_path)

def generate_pdf_from_html(html_content, pdf_path):
    """
    Generate a PDF file from HTML content (WeasyPrint 61+ API)
    """
    try:
        from weasyprint import HTML
        current_app.logger.info(f"Generating PDF at {pdf_path} using WeasyPrint 61+ API")
        html = HTML(string=html_content)
        html.write_pdf(pdf_path)  # WeasyPrint 61+ API
        current_app.logger.info(f"Successfully generated PDF ({os.path.getsize(pdf_path)} bytes)")
        return pdf_path
    except Exception as e:
        current_app.logger.error(f"Error in generate_pdf_from_html: {str(e)}")
        raise

def send_email(subject, recipients, body, attachments=None, cc=None, html=None):
    from flask import current_app
    
    current_app.logger.info(f"Preparing to send email: subject='{subject}', to={recipients}")
    current_app.logger.info(f"Using SMTP Settings from App Config: " +
                          f"server={current_app.config.get('MAIL_SERVER')}, " +
                          f"port={current_app.config.get('MAIL_PORT')}, " +
                          f"user={current_app.config.get('MAIL_USERNAME')}, " +
                          f"TLS={current_app.config.get('MAIL_USE_TLS')}, " +
                          f"sender={current_app.config.get('MAIL_DEFAULT_SENDER')}")
    
    try:
        # Check if essential config is missing (optional, but good practice)
        if not all([current_app.config.get('MAIL_SERVER'), 
                    current_app.config.get('MAIL_PORT'), 
                    current_app.config.get('MAIL_USERNAME'), 
                    current_app.config.get('MAIL_PASSWORD')]):
            error_msg = "Missing essential SMTP configuration in environment variables (MAIL_SERVER, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD)"
            current_app.logger.error(error_msg)
            raise ValueError(error_msg)
            
        # Create message using configured default sender
        msg = Message(subject, recipients=recipients, cc=cc, body=body, html=html)
        
        # Handle attachments
        attachments = attachments or []
        for att in attachments:
            with open(att, 'rb') as f:
                msg.attach(os.path.basename(att), 'application/pdf', f.read())
        
        # Send using the mail instance initialized with app config
        mail.send(msg)
        current_app.logger.info("Email sent successfully")

    except Exception as e:
        current_app.logger.error(f"Email sending failed: {str(e)}", exc_info=True)
        # Re-raise the exception so it can be handled by the caller
        raise

def create_violation_html(violation, field_defs=None):
    """
    Generate HTML for a violation with UUID-based filename
    
    Args:
        violation: The violation object
        field_defs: Optional field definitions to use
        
    Returns:
        tuple: (html_path, html_content)
    """
    from .models import ViolationFieldValue, FieldDefinition, ViolationReply, User
    from flask import current_app, render_template, url_for
    import os
    import uuid

    # Use cached field definitions if not provided
    if field_defs is None:
        field_defs = get_cached_fields('all')
    
    # Get field values for the violation
    field_values = ViolationFieldValue.query.filter_by(violation_id=violation.id).all()
    
    # Create dictionary of field values (for dynamic_fields)
    dynamic_fields = {}
    field_images = {}
    
    for fv in field_values:
        # Find the field definition
        field_def = next((f for f in field_defs if f.id == fv.field_definition_id), None)
        if field_def:
            dynamic_fields[field_def.name] = fv.value
            
            # Check if this is a file field with image paths
            if field_def.type == 'file' and fv.value:
                # Split comma-separated paths
                image_paths = [path.strip() for path in fv.value.split(',') if path.strip()]
                if image_paths:
                    field_images[field_def.name] = image_paths
    
    # Get replies for the violation
    replies = ViolationReply.query.filter_by(violation_id=violation.id).order_by(ViolationReply.created_at).all()
    
    # Get creator info
    creator = None
    if violation.created_by:
        creator = User.query.get(violation.created_by)
    
    # Parse attached evidence if it exists and is valid JSON
    evidence_list = []
    if violation.attach_evidence:
        try:
            parsed_evidence = json.loads(violation.attach_evidence)
            # Ensure it's a list (or adapt if structure differs)
            if isinstance(parsed_evidence, list):
                evidence_list = parsed_evidence
            else:
                 current_app.logger.warning(f"Parsed attach_evidence for violation {violation.id} is not a list: {type(parsed_evidence)}")
        except json.JSONDecodeError as e:
            current_app.logger.error(f"Error decoding attach_evidence JSON for violation {violation.id}: {e}")
            # Optionally handle non-JSON data if needed, e.g., if it's a simple string path
            # evidence_list = [{'filename': violation.attach_evidence, 'originalname': 'Attached File'}] 

    # Generate UUID-based filename
    unique_id = str(uuid.uuid4())
    filename = f"{unique_id}_{violation.id}.html"
    
    # Create secure directory path
    secure_dir = os.path.join(current_app.config['BASE_DIR'], 'saved_files', 'html')
    os.makedirs(secure_dir, exist_ok=True)
    
    # Generate full file path
    file_path = os.path.join(secure_dir, filename)
    
    # Render the HTML template, passing the parsed evidence list
    html_content = render_template(
        'violations/detail.html',
        violation=violation,
        dynamic_fields=dynamic_fields,
        field_images=field_images,
        has_images=bool(field_images),
        evidence_list=evidence_list,
        field_defs=field_defs,
        replies=replies,
        creator=creator
    )
    
    # Write the HTML to file
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    # Store the secure relative path in the database
    from . import db
    relative_path = os.path.join('saved_files', 'html', filename)
    violation.html_path = relative_path
    db.session.commit()
    
    return file_path, html_content

def generate_violation_pdf(violation, html_content=None):
    """
    Generate PDF for a violation with UUID-based filename (WeasyPrint 61+ API)
    """
    try:
        import uuid, os, tempfile
        from flask import current_app
        from weasyprint import HTML
        unique_id = str(uuid.uuid4())
        filename = f"{unique_id}_{violation.id}.pdf"
        secure_dir = os.path.join(current_app.config['BASE_DIR'], 'saved_files', 'pdf')
        os.makedirs(secure_dir, exist_ok=True)
        file_path = os.path.join(secure_dir, filename)
        if not html_content:
            if violation.html_path and os.path.exists(os.path.join(current_app.config['BASE_DIR'], violation.html_path)):
                with open(os.path.join(current_app.config['BASE_DIR'], violation.html_path), 'r', encoding='utf-8') as f:
                    html_content = f.read()
            else:
                _, html_content = create_violation_html(violation)
        try:
            HTML(string=html_content).write_pdf(file_path)
            current_app.logger.info(f"Generated PDF using direct HTML string: {file_path}")
        except Exception as e:
            current_app.logger.warning(f"Direct HTML string PDF generation failed: {str(e)}")
            try:
                with tempfile.NamedTemporaryFile(suffix='.html', delete=False) as temp_html:
                    temp_html.write(html_content.encode('utf-8'))
                    temp_html_path = temp_html.name
                HTML(filename=temp_html_path).write_pdf(file_path)
                os.unlink(temp_html_path)
                current_app.logger.info(f"Generated PDF using temporary file approach: {file_path}")
            except Exception as e2:
                current_app.logger.error(f"Temporary file PDF generation failed: {str(e2)}")
                with open(file_path, 'w') as f:
                    f.write("%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 0 >>\nstream\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000010 00000 n\n0000000059 00000 n\n0000000118 00000 n\n0000000217 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n267\n%%EOF")
                current_app.logger.warning(f"Created empty fallback PDF: {file_path}")
        from . import db
        relative_path = os.path.join('saved_files', 'pdf', filename)
        violation.pdf_path = relative_path
        db.session.commit()
        return file_path
    except Exception as e:
        current_app.logger.error(f"Error generating PDF: {str(e)}")
        return None

def send_violation_notification(violation, html_path):
    """
    Send email notification about a new violation
    
    Args:
        violation: The violation object
        html_path: Path to the HTML file
    """
    from .models import ViolationFieldValue, FieldDefinition, User, Settings
    from flask import request
    
    # Get all email fields from the violation
    email_addresses = []
    
    # Get field definitions for email type, using cache
    email_fields = get_cached_fields('email')
    
    if email_fields:
        for field in email_fields:
            # Get the value for this field in the violation
            field_value = ViolationFieldValue.query.filter_by(
                violation_id=violation.id,
                field_definition_id=field.id
            ).first()
            
            if field_value and field_value.value and '@' in field_value.value:
                # Add to email addresses list
                email_addresses.append(field_value.value)
    
    # Add global notification recipients if enabled
    settings = Settings.get_settings()
    if settings.enable_global_notifications and settings.notification_emails:
        global_emails = settings.get_notification_emails_list()
        email_addresses.extend(global_emails)
    
    # Remove duplicates
    email_addresses = list(dict.fromkeys(email_addresses))
    
    if not email_addresses:
        current_app.logger.info(f"No email addresses found for notification of violation {violation.id}")
        return
    
    # Get dynamic field values
    field_values = ViolationFieldValue.query.filter_by(violation_id=violation.id).all()
    dynamic_fields = {}
    field_defs = get_cached_fields('all')
    
    for fv in field_values:
        field_def = next((f for f in field_defs if f.id == fv.field_definition_id), None)
        if field_def:
            dynamic_fields[field_def.name] = fv.value
    
    # Get the values for the email with fallbacks to static fields
    category = dynamic_fields.get('Category', violation.category) or violation.category or ''
    details = dynamic_fields.get('Details', violation.details) or violation.details or ''
    
    # Create email message
    subject = f"New Violation Report: {violation.reference}"
    
    # Generate secure token for this violation
    # Use public_id if available, otherwise use regular ID
    violation_id_for_token = violation.public_id if hasattr(violation, 'public_id') and violation.public_id else violation.id
    token = generate_secure_access_token(violation_id_for_token)
    
    # Get base URL
    base_url = current_app.config.get('BASE_URL', f"http://{request.host if request else 'localhost:5004'}")
    
    # Create secure URLs
    view_url = f"{base_url}/violations/secure/{token}"
    
    # Create plain text message
    body = f"""A new violation has been reported with reference {violation.reference}.

Details:
Reference: {violation.reference}
Category: {category}
Incident Details: {details}

You can view the full details at:
{view_url}
"""
    
    # Create HTML message
    html_body = f"""
    <h2>New Violation Report</h2>
    <p>A new violation has been reported with reference <strong>{violation.reference}</strong>.</p>
    
    <h3>Details:</h3>
    <ul>
        <li><strong>Reference:</strong> {violation.reference}</li>
        <li><strong>Category:</strong> {category}</li>
        <li><strong>Incident Details:</strong> {details}</li>
    </ul>
    
    <p>You can view the full details by <a href="{view_url}">clicking here</a>.</p>
    <p><small>This link is valid for 24 hours and your access will be logged for security purposes.</small></p>
    """
    
    try:
        send_email(
            subject=subject,
            recipients=email_addresses,
            body=body,
            html=html_body
        )
        current_app.logger.info(f"Sent violation notification to {len(email_addresses)} recipients")
        return True
    except Exception as e:
        current_app.logger.error(f"Error sending violation notification: {str(e)}")
        return False

# ClamAV Virus Scanning Integration
def init_clamav():
    """
    Initialize ClamAV scanner connection
    
    Returns:
        pyclamd.ClamdUnixSocket or pyclamd.ClamdNetworkSocket or None
    """
    try:
        import pyclamd
        
        # Try to connect to ClamAV daemon via Unix socket
        try:
            clam = pyclamd.ClamdUnixSocket()
            # Test the connection
            if clam.ping():
                current_app.logger.info("ClamAV daemon is running (Unix socket)")
                return clam
        except Exception as e:
            current_app.logger.warning(f"Unable to connect to ClamAV daemon via Unix socket: {str(e)}")
        
        # Try to connect to ClamAV daemon via network
        try:
            clam = pyclamd.ClamdNetworkSocket()
            # Test the connection
            if clam.ping():
                current_app.logger.info("ClamAV daemon is running (Network socket)")
                return clam
        except Exception as e:
            current_app.logger.warning(f"Unable to connect to ClamAV daemon via network: {str(e)}")
        
        current_app.logger.error("Could not connect to ClamAV daemon")
        return None
    
    except ImportError:
        current_app.logger.error("pyclamd module not installed")
        return None

def scan_file(file_path):
    """
    Scan a file for viruses using ClamAV
    
    Args:
        file_path: Path to the file to scan
        
    Returns:
        tuple: (is_clean, result_message)
    """
    try:
        # Initialize ClamAV
        clam = init_clamav()
        
        if not clam:
            current_app.logger.warning("ClamAV not available, skipping virus scan")
            return True, "Virus scan skipped (ClamAV not available)"
        
        # Scan the file
        scan_result = clam.scan_file(file_path)
        
        # If scan_result is None, the file is clean
        if scan_result is None:
            current_app.logger.info(f"File is clean: {file_path}")
            return True, "File is clean"
        
        # If we have a result, the file is infected
        current_app.logger.warning(f"Infected file detected: {file_path}, {scan_result}")
        return False, f"Infected: {scan_result[file_path]}"
    
    except Exception as e:
        current_app.logger.error(f"Error scanning file {file_path}: {str(e)}")
        # Since we can't be sure, we'll err on the side of caution
        return False, f"Scan error: {str(e)}"

def secure_handle_uploaded_file(file, violation_id, field_name, subdir='fields'):
    """
    Securely handle an uploaded file with virus scanning and content type validation
    
    Args:
        file: The uploaded file object
        violation_id: The violation ID
        field_name: The field name for the file
        subdir: Subdirectory within uploads (default: 'fields')
        
    Returns:
        tuple: (success, file_path or error_message)
    """
    from werkzeug.utils import secure_filename
    
    # Allowed MIME types
    ALLOWED_MIME_TYPES = {
        'image/jpeg',
        'image/png',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
    }
    try:
        # Check if file exists
        if not file or not file.filename:
            return False, "No file provided"
        
        # Generate secure filename with UUID
        original_filename = secure_filename(file.filename)
        unique_id = str(uuid.uuid4())
        unique_filename = f"{unique_id}_{original_filename}"
        
        # Create secure directory structure
        secure_dir = os.path.join(
            current_app.config['BASE_DIR'],
            'saved_files',
            'uploads',
            subdir,
            f'violation_{violation_id}'
        )
        os.makedirs(secure_dir, exist_ok=True)
        
        # Generate full file path
        file_path = os.path.join(secure_dir, unique_filename)
        
        # Save the file temporarily for scanning and validation
        file.save(file_path)
        
        # Verify the file was saved successfully
        if not os.path.exists(file_path):
            return False, "Failed to save file"
        
        if os.path.getsize(file_path) == 0:
            os.remove(file_path)
            return False, "Empty file"
        
        # Content type validation
        detected_type = None
        try:
            import magic
            mime = magic.Magic(mime=True)
            detected_type = mime.from_file(file_path)
        except ImportError:
            detected_type = file.mimetype
        
        if detected_type not in ALLOWED_MIME_TYPES:
            os.remove(file_path)
            return False, f"File type {detected_type} is not allowed."
        
        # Scan the file for viruses
        is_clean, scan_result = scan_file(file_path)
        
        # If the file is not clean, delete it
        if not is_clean:
            os.remove(file_path)
            return False, f"Virus detected: {scan_result}"
        
        # Return the relative path for database storage
        relative_path = os.path.join(
            'saved_files',
            'uploads',
            subdir,
            f'violation_{violation_id}',
            unique_filename
        )
        
        return True, relative_path
    
    except Exception as e:
        current_app.logger.error(f"Error handling uploaded file: {str(e)}")
        # If an error occurs, try to clean up the file
        try:
            if 'file_path' in locals() and os.path.exists(file_path):
                os.remove(file_path)
        except:
            pass
        return False, f"Error: {str(e)}"

# Token generation for secure violation access
def generate_secure_access_token(violation_id, expiration_hours=24):
    """
    Generate a signed, time-limited token for violation access
    
    Args:
        violation_id: ID or public_id of the violation
        expiration_hours: Hours until token expires
        
    Returns:
        str: Secure access token
    """
    # Create serializer with app secret
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    
    # Create payload with violation ID and timestamp
    payload = {
        'violation_id': violation_id,
        'created': int(time.time()),
        'is_uuid': not isinstance(violation_id, int)  # Flag to identify if the ID is a UUID
    }
    
    # Generate token
    return serializer.dumps(payload)

def validate_secure_access_token(token, max_age=86400):
    """
    Validate a secure access token and extract violation ID
    
    Args:
        token: Token to validate
        max_age: Maximum age in seconds (default 24 hours)
        
    Returns:
        int/str or None: Violation ID if valid, None if invalid
    """
    from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
    from flask import current_app
    
    # Create serializer with app secret
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    
    try:
        # Load and validate token
        data = serializer.loads(token, max_age=max_age)
        
        # Return the ID, checking if it's a UUID (str) or regular ID (int)
        return data.get('violation_id')
    except (BadSignature, SignatureExpired):
        return None
    except Exception as e:
        current_app.logger.error(f"Error validating token: {str(e)}")
        return None

def log_violation_access(violation_id, token, request):
    """
    Log access to a violation
    
    Args:
        violation_id: ID of the violation
        token: Access token used
        request: Flask request object
        
    Returns:
        ViolationAccess: Created log entry
    """
    from .models import ViolationAccess
    from . import db
    
    # Create log entry
    log = ViolationAccess(
        violation_id=violation_id,
        ip_address=request.remote_addr,
        user_agent=request.user_agent.string,
        token=token,
    )
    
    # Save to database
    db.session.add(log)
    db.session.commit()
    
    return log

def send_secure_urls(violation):
    """Generate secure URLs for a violation
    
    Args:
        violation: The violation object
        
    Returns:
        dict: Dictionary with secure URLs
    """
    from flask import request
    
    # Generate token for this violation - prefer public_id when available
    violation_id_for_token = violation.public_id if hasattr(violation, 'public_id') and violation.public_id else violation.id
    token = generate_secure_access_token(violation_id_for_token)
    
    # Get base URL
    base_url = current_app.config.get('BASE_URL', f"http://{request.host}")
    
    # Create secure URLs
    html_url = f"{base_url}/violations/secure/{token}"
    pdf_url = f"{base_url}/violations/secure/{token}/pdf"
    
    return {
        'html_url': html_url,
        'pdf_url': pdf_url,
        'token': token
    }
