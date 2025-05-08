from flask import current_app, render_template
from flask_mail import Message
from . import mail
# Removed: from .models import Settings
import logging

logger = logging.getLogger(__name__)

def send_password_reset_email(user_email, reset_link):
    """Sends the password reset email to the user."""
    try:
        # Removed: Settings fetching and validation block
        # Check if essential config is present (optional, relies on send_email doing the check)
        if not all([current_app.config.get('MAIL_SERVER'), 
                    current_app.config.get('MAIL_PORT'), 
                    current_app.config.get('MAIL_USERNAME'), 
                    current_app.config.get('MAIL_PASSWORD'),
                    current_app.config.get('MAIL_DEFAULT_SENDER')]):
            error_msg = "SMTP email system is not configured in environment variables."
            logger.error(error_msg)
            # Depending on desired behaviour, you might raise an error or return False
            return False # Fail gracefully if config missing

        # Get sender from app config
        sender = current_app.config.get('MAIL_DEFAULT_SENDER')
        
        # Removed: Check if mail is configured, as it should be if essentials are present

        subject = "Reset Your Password - Spectrum 4 Violation System"
        from datetime import datetime
        current_year = datetime.utcnow().year
        html_body = render_template('email/password_reset.html', 
                                      reset_link=reset_link, 
                                      current_year=current_year)

        msg = Message(subject,
                      sender=sender, # Use sender from config
                      recipients=[user_email],
                      html=html_body)

        mail.send(msg)
        logger.info(f"Password reset email successfully sent to {user_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send password reset email to {user_email}: {str(e)}", exc_info=True)
        return False 