import aiosmtplib
from email.mime.text import MIMEText
from app.config import settings


async def send_task_assignment_email(
    to_email: str,
    to_name: str,
    task_title: str,
    deadline: str,
    kanban_url: str,
):
    """
    Send a task assignment notification email via SMTP.
    This should be called as a background task (asyncio.create_task)
    so it does not block the API response.
    """
    body = f"""
Hi {to_name},

You have been assigned a new task in Briefr:

Task: {task_title}
Deadline: {deadline}

View your tasks here: {kanban_url}

— Briefr
"""
    msg = MIMEText(body)
    msg["Subject"] = f"New task assigned: {task_title}"
    msg["From"] = settings.SMTP_USER
    msg["To"] = to_email

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
    except Exception as e:
        # Log but don't crash — email is best-effort
        print(f"[EMAIL] Failed to send to {to_email}: {e}")
