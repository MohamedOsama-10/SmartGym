import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings

def send_reset_password_email(email: str, token: str, user_name: str):
    """Send password reset email to user"""
    
    # Create reset link
    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    
    # Email content
    subject = "Password Reset Request - Gym Management System"
    
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #4CAF50;">Password Reset Request</h2>
                <p>Hi {user_name},</p>
                <p>We received a request to reset your password for your Gym Management account.</p>
                <p>Click the button below to reset your password:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_link}" 
                       style="background-color: #4CAF50; color: white; padding: 12px 30px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        Reset Password
                    </a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <p style="background-color: #f4f4f4; padding: 10px; border-radius: 5px; word-break: break-all;">
                    {reset_link}
                </p>
                <p><strong>This link will expire in 15 minutes.</strong></p>
                <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
                <p style="color: #888; font-size: 12px;">
                    This is an automated message from Gym Management System. Please do not reply to this email.
                </p>
            </div>
        </body>
    </html>
    """
    
    text_content = f"""
    Password Reset Request
    
    Hi {user_name},
    
    We received a request to reset your password for your Gym Management account.
    
    Click the link below to reset your password:
    {reset_link}
    
    This link will expire in 15 minutes.
    
    If you didn't request a password reset, please ignore this email.
    
    ---
    Gym Management System
    """
    
    # Create message
    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
    message["To"] = email
    
    # Attach both text and HTML versions
    part1 = MIMEText(text_content, "plain")
    part2 = MIMEText(html_content, "html")
    message.attach(part1)
    message.attach(part2)
    
    try:
        # Connect to Gmail SMTP server
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()  # Secure the connection
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.EMAILS_FROM_EMAIL, email, message.as_string())
        
        return True
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        return False