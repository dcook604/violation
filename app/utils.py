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
import subprocess

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
    Generate a PDF file from HTML content
    
    Args:
        html_content: HTML content to convert to PDF
        pdf_path: Path to save the PDF file
        
    Returns:
        str: Path to the generated PDF file
    """
    try:
        # First attempt: Direct conversion using document.render() for WeasyPrint 61+
        from weasyprint import HTML
        current_app.logger.info(f"Generating PDF at {pdf_path} using WeasyPrint 61+ API")
        
        # Generate HTML document and render
        html = HTML(string=html_content)
        document = html.render()
        
        # Write to PDF file
        with open(pdf_path, 'wb') as pdf_file:
            try:
                document.write_pdf(pdf_file)
                current_app.logger.info(f"Successfully generated PDF ({os.path.getsize(pdf_path)} bytes)")
                return pdf_path
            except TypeError as err:
                if "PDF.__init__() takes 1 positional argument but 3 were given" in str(err):
                    current_app.logger.warning(f"pydyf compatibility issue detected: {err}")
                    # Close the file and use alternative approach
                    pdf_file.close()
                    raise Exception("pydyf compatibility issue - using fallback approach")
                else:
                    raise
            
    except Exception as e:
        current_app.logger.error(f"Error in generate_pdf_from_html (attempt 1): {str(e)}")
        
        # Second attempt: Using a temporary file and command-line tools
        try:
            import tempfile
            import subprocess
            
            current_app.logger.info(f"Trying command-line PDF generation")
            temp_html = tempfile.NamedTemporaryFile(suffix='.html', delete=False)
            
            try:
                # Write HTML to temp file
                with open(temp_html.name, 'w', encoding='utf-8') as f:
                    f.write(html_content)
                
                # Try using wkhtmltopdf command-line tool if available
                try:
                    cmd = ['/usr/bin/wkhtmltopdf', temp_html.name, pdf_path]
                    current_app.logger.info(f"Executing: {' '.join(cmd)}")
                    result = subprocess.run(cmd, capture_output=True, text=True)
                    
                    if result.returncode == 0:
                        current_app.logger.info(f"PDF successfully generated using wkhtmltopdf")
                        return pdf_path
                    else:
                        current_app.logger.error(f"wkhtmltopdf error: {result.stderr}")
                        raise Exception(f"wkhtmltopdf failed: {result.stderr}")
                except (subprocess.SubprocessError, FileNotFoundError) as e:
                    current_app.logger.error(f"Could not use wkhtmltopdf: {str(e)}")
                    raise Exception("Command-line PDF generation failed")
            finally:
                # Clean up temporary file
                if os.path.exists(temp_html.name):
                    os.unlink(temp_html.name)
                    
        except Exception as e2:
            current_app.logger.error(f"Error in generate_pdf_from_html (attempt 2): {str(e2)}")
            raise Exception(f"Failed to generate PDF: {str(e2)}")

def send_email(subject, recipients, body, attachments=None, cc=None, html=None):
    from .models import Settings
    from flask import current_app
    import time
    
    # Get settings from the database
    settings = Settings.get_settings()
    
    # Log the intent to send an email with settings details
    current_app.logger.info(f"Preparing to send email: subject='{subject}', to={recipients}")
    current_app.logger.info(f"SMTP Settings: server={settings.smtp_server}, port={settings.smtp_port}, user={settings.smtp_username}, TLS={settings.smtp_use_tls}")
    
    try:
        # Only apply database settings if they're properly configured
        if settings.smtp_server and settings.smtp_port and settings.smtp_username and settings.smtp_password:
            from flask_mail import Mail, Message
            import copy
            
            # Create a copy of the current app config
            config = copy.deepcopy(current_app.config)
            
            # Override with settings from database
            config['MAIL_SERVER'] = settings.smtp_server
            config['MAIL_PORT'] = settings.smtp_port
            config['MAIL_USERNAME'] = settings.smtp_username
            config['MAIL_PASSWORD'] = settings.smtp_password
            config['MAIL_USE_TLS'] = settings.smtp_use_tls
            if settings.smtp_from_email:
                config['MAIL_DEFAULT_SENDER'] = settings.smtp_from_name + ' <' + settings.smtp_from_email + '>' if settings.smtp_from_name else settings.smtp_from_email
            
            # Store original config values
            original_server = current_app.config.get('MAIL_SERVER')
            original_port = current_app.config.get('MAIL_PORT')
            original_username = current_app.config.get('MAIL_USERNAME')
            original_password = current_app.config.get('MAIL_PASSWORD')
            original_tls = current_app.config.get('MAIL_USE_TLS')
            original_sender = current_app.config.get('MAIL_DEFAULT_SENDER')
            
            # Set config to use database settings
            current_app.config['MAIL_SERVER'] = config['MAIL_SERVER']
            current_app.config['MAIL_PORT'] = config['MAIL_PORT']
            current_app.config['MAIL_USERNAME'] = config['MAIL_USERNAME']
            current_app.config['MAIL_PASSWORD'] = config['MAIL_PASSWORD']
            current_app.config['MAIL_USE_TLS'] = config['MAIL_USE_TLS']
            current_app.config['MAIL_DEFAULT_SENDER'] = config.get('MAIL_DEFAULT_SENDER', original_sender)
            
            # Debug logging - show what we're using (masking password)
            current_app.logger.info(f"Using SMTP: {config['MAIL_SERVER']}:{config['MAIL_PORT']} " +
                              f"with user={config['MAIL_USERNAME']}, " +
                              f"TLS={config['MAIL_USE_TLS']}")
            
            try:
                # Import mail from app
                from . import mail
                
                # Test direct connection to SMTP server before sending
                import socket
                socket_test_start = time.time()
                current_app.logger.info(f"Testing socket connection to {config['MAIL_SERVER']}:{config['MAIL_PORT']}...")
                
                try:
                    sock = socket.create_connection((config['MAIL_SERVER'], config['MAIL_PORT']), timeout=10)
                    sock.close()
                    socket_test_time = time.time() - socket_test_start
                    current_app.logger.info(f"Socket connection successful ({socket_test_time:.2f}s)")
                except Exception as sock_err:
                    current_app.logger.error(f"Socket connection failed: {str(sock_err)}")
                    raise Exception(f"Cannot connect to SMTP server {config['MAIL_SERVER']}:{config['MAIL_PORT']}: {str(sock_err)}")
                
                # Create message with current settings
                msg = Message(subject, recipients=recipients, cc=cc, body=body, html=html)
                attachments = attachments or []
                for att in attachments:
                    with open(att, 'rb') as f:
                        msg.attach(os.path.basename(att), 'application/pdf', f.read())
                
                # Send with mail instance from app context
                mail.send(msg)
                current_app.logger.info("Email sent successfully")
            except Exception as e:
                current_app.logger.error(f"Error sending email with custom SMTP settings: {str(e)}")
                raise
            finally:
                # Restore original config
                current_app.config['MAIL_SERVER'] = original_server
                current_app.config['MAIL_PORT'] = original_port
                current_app.config['MAIL_USERNAME'] = original_username
                current_app.config['MAIL_PASSWORD'] = original_password
                current_app.config['MAIL_USE_TLS'] = original_tls
                current_app.config['MAIL_DEFAULT_SENDER'] = original_sender
        else:
            # Missing required settings
            missing = []
            if not settings.smtp_server:
                missing.append("SMTP Server")
            if not settings.smtp_port:
                missing.append("SMTP Port")
            if not settings.smtp_username:
                missing.append("SMTP Username")
            if not settings.smtp_password:
                missing.append("SMTP Password")
            
            missing_str = ", ".join(missing)
            error_msg = f"Missing required SMTP settings: {missing_str}"
            current_app.logger.error(error_msg)
            raise Exception(error_msg)
    except Exception as e:
        current_app.logger.error(f"Email sending failed: {str(e)}")
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
    
    # Generate UUID-based filename
    unique_id = str(uuid.uuid4())
    filename = f"{unique_id}_{violation.id}.html"
    
    # Create secure directory path
    secure_dir = os.path.join(current_app.config['BASE_DIR'], 'saved_files', 'html')
    os.makedirs(secure_dir, exist_ok=True)
    
    # Generate full file path
    file_path = os.path.join(secure_dir, filename)
    
    # Render the HTML template
    html_content = render_template(
        'violations/detail.html',
        violation=violation,
        dynamic_fields=dynamic_fields,
        field_images=field_images,
        has_images=bool(field_images),
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
    Generate PDF for a violation with UUID-based filename
    
    Args:
        violation: The violation object
        html_content: Optional HTML content to convert
        
    Returns:
        str: Path to the generated PDF file
    """
    try:
        # Generate UUID-based filename
        unique_id = str(uuid.uuid4())
        filename = f"{unique_id}_{violation.id}.pdf"
        
        # Create secure directory path
        secure_dir = os.path.join(current_app.config['BASE_DIR'], 'saved_files', 'pdf')
        os.makedirs(secure_dir, exist_ok=True)
        
        # Generate full file path
        file_path = os.path.join(secure_dir, filename)
        
        # Get HTML content if not provided
        if not html_content:
            if violation.html_path and os.path.exists(os.path.join(current_app.config['BASE_DIR'], violation.html_path)):
                with open(os.path.join(current_app.config['BASE_DIR'], violation.html_path), 'r', encoding='utf-8') as f:
                    html_content = f.read()
            else:
                # Generate HTML if no path or file doesn't exist
                _, html_content = create_violation_html(violation)
        
        # Write HTML to temp file for wkhtmltopdf
        with tempfile.NamedTemporaryFile(suffix='.html', delete=False) as temp_html:
            temp_html.write(html_content.encode('utf-8'))
            temp_html_path = temp_html.name
        
        try:
            # Use wkhtmltopdf to generate PDF (direct method)
            cmd = ['/usr/bin/wkhtmltopdf', temp_html_path, file_path]
            current_app.logger.info(f"Executing wkhtmltopdf: {' '.join(cmd)}")
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                current_app.logger.info(f"PDF generated successfully using wkhtmltopdf: {file_path} ({os.path.getsize(file_path)} bytes)")
            else:
                current_app.logger.error(f"wkhtmltopdf error: {result.stderr}")
                # Create a minimal fallback PDF if wkhtmltopdf fails
                with open(file_path, 'w') as f:
                    f.write("%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 0 >>\nstream\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000010 00000 n\n0000000059 00000 n\n0000000118 00000 n\n0000000217 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n267\n%%EOF")
                current_app.logger.warning(f"Created empty fallback PDF: {file_path}")
        finally:
            # Clean up temporary file
            if os.path.exists(temp_html_path):
                os.unlink(temp_html_path)
        
        # Store the secure relative path in the database
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
    
    # Get dynamic field values - explicitly fetch each important field
    field_defs = get_cached_fields('all')
    field_values = ViolationFieldValue.query.filter_by(violation_id=violation.id).all()
    dynamic_fields = {}
    
    for fv in field_values:
        field_def = next((f for f in field_defs if f.id == fv.field_definition_id), None)
        if field_def:
            dynamic_fields[field_def.name] = fv.value
    
    # Get the values for the email with fallbacks to static fields
    category = dynamic_fields.get('Category', violation.category) or violation.category or ''
    
    # Special handling for incident details
    incident_details = ""
    # First try to get it from dynamic field called "Incident Details:"
    if "Incident Details:" in dynamic_fields and dynamic_fields["Incident Details:"]:
        incident_details = dynamic_fields["Incident Details:"]
    # Then try without the colon
    elif "Incident Details" in dynamic_fields and dynamic_fields["Incident Details"]:
        incident_details = dynamic_fields["Incident Details"]
    # Then try generic "Details" field
    elif "Details" in dynamic_fields and dynamic_fields["Details"]:
        incident_details = dynamic_fields["Details"]
    # Fall back to violation.details
    elif violation.details:
        incident_details = violation.details
    # If still empty, set a placeholder
    if not incident_details:
        incident_details = "[No details provided]"
    
    # Log the incident details for debugging
    current_app.logger.info(f"Incident details for email: {incident_details}")
    current_app.logger.info(f"All dynamic fields: {json.dumps(dynamic_fields)}")
    
    # Create email message
    subject = f"New Violation Report: {violation.reference}"
    
    # Generate secure token for this violation with 7-day expiration
    token = generate_secure_access_token(violation.id, expiration_hours=168)  # 7 days = 168 hours
    
    # Get base URL
    base_url = current_app.config.get('BASE_URL', f"http://{request.host if request else 'localhost:5004'}")
    
    # Create secure URLs - ensure no trailing slashes in base_url
    if base_url.endswith('/'):
        base_url = base_url[:-1]
    
    view_url = f"{base_url}/violations/secure/{token}"
    
    # Create plain text message
    body = f"""A new violation has been reported with reference {violation.reference}.

Details:
Reference: {violation.reference}
Category: {category}
Incident Details: {incident_details}

Additional Information:
"""
    
    # Add the rest of the dynamic fields
    for k, v in dynamic_fields.items():
        if k not in ['Category', 'Incident Details', 'Incident Details:'] and v:
            body += f"{k}: {v}\n"
    
    body += f"""
You can view the full details at:
{view_url}

This link is valid for 7 days and your access will be logged for security purposes.
"""
    
    # Create HTML message
    html_body = f"""
    <h2>New Violation Report</h2>
    <p>A new violation has been reported with reference <strong>{violation.reference}</strong>.</p>
    
    <h3>Details:</h3>
    <ul>
        <li><strong>Reference:</strong> {violation.reference}</li>
        <li><strong>Category:</strong> {category}</li>
        <li><strong>Incident Details:</strong> {incident_details}</li>
    </ul>
    
    <h3>Additional Information:</h3>
    <ul>
        {' '.join([f'<li><strong>{k}:</strong> {v}</li>' for k, v in dynamic_fields.items() 
                 if k not in ['Category', 'Incident Details', 'Incident Details:'] and v])}
    </ul>
    
    <p>You can view the full details by <a href="{view_url}">clicking here</a>.</p>
    <p><small>This link is valid for 7 days and your access will be logged for security purposes.</small></p>
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
    Securely handle an uploaded file with virus scanning
    
    Args:
        file: The uploaded file object
        violation_id: The violation ID
        field_name: The field name for the file
        subdir: Subdirectory within uploads (default: 'fields')
        
    Returns:
        tuple: (success, file_path or error_message)
    """
    # Import inside function to avoid circular imports
    from werkzeug.utils import secure_filename
    
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
        
        # Set directory permissions to allow group read/execute access for ClamAV
        try:
            # chmod 755 - owner can read/write/execute, group can read/execute, others can read/execute
            # This ensures ClamAV can access the directory and files
            os.chmod(secure_dir, 0o755)
            current_app.logger.info(f"Set permissions on directory: {secure_dir}")
        except Exception as e:
            current_app.logger.warning(f"Failed to set permissions on directory {secure_dir}: {str(e)}")
        
        # Generate full file path
        file_path = os.path.join(secure_dir, unique_filename)
        
        # Save the file temporarily for scanning
        file.save(file_path)
        
        # Set file permissions to allow group read access for ClamAV
        try:
            # chmod 644 - owner can read/write, group can read, others can read
            os.chmod(file_path, 0o644)
            current_app.logger.info(f"Set permissions on file: {file_path}")
        except Exception as e:
            current_app.logger.warning(f"Failed to set permissions on file {file_path}: {str(e)}")
        
        # Verify the file was saved successfully
        if not os.path.exists(file_path):
            return False, "Failed to save file"
        
        if os.path.getsize(file_path) == 0:
            os.remove(file_path)
            return False, "Empty file"
        
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
        violation_id: ID of the violation
        expiration_hours: Hours until token expires
        
    Returns:
        str: Secure access token
    """
    # Create serializer with app secret
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    
    # Create payload with violation ID and timestamp
    payload = {
        'violation_id': violation_id,
        'created': int(time.time())
    }
    
    # Generate token
    return serializer.dumps(payload)

def validate_secure_access_token(token, max_age=604800):  # 7 days = 604800 seconds
    """
    Validate a secure access token and extract violation ID
    
    Args:
        token: Token to validate
        max_age: Maximum age in seconds (default 7 days)
        
    Returns:
        int or None: Violation ID if valid, None if invalid
    """
    from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
    from flask import current_app
    
    # Create serializer with app secret
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    
    try:
        # Load and validate token
        data = serializer.loads(token, max_age=max_age)
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
