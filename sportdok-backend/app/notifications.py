import logging
import os
import smtplib
from email.message import EmailMessage
from typing import Optional

logger = logging.getLogger("sportdok.email")
logger.setLevel(logging.INFO)
if not logger.handlers:
    # Настраиваем логгер явно, а не полагаемся на root/uvicorn - иначе
    # при уровне WARNING по умолчанию письма молча пропадут из консоли.
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(asctime)s [%(name)s] %(message)s"))
    logger.addHandler(_handler)


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def smtp_configured() -> bool:
    return bool(_env("SMTP_HOST") and _env("SMTP_USER") and _env("SMTP_PASSWORD"))


def send_email(to: str, subject: str, body: str) -> bool:
    """Отправка письма. Возвращает True при успехе.

    Без SMTP_* в окружении письмо только логируется (удобно для локальной разработки).
    На проде задайте SMTP_HOST/PORT/USER/PASSWORD/FROM — например smtp.timeweb.ru:465.
    """
    logger.info("EMAIL to=%s subject=%r\n%s", to, subject, body)

    if not smtp_configured():
        logger.warning(
            "SMTP не настроен (нужны SMTP_HOST, SMTP_USER, SMTP_PASSWORD) — письмо не отправлено"
        )
        return False

    host = _env("SMTP_HOST")
    port = int(_env("SMTP_PORT", "465") or "465")
    user = _env("SMTP_USER")
    password = _env("SMTP_PASSWORD")
    mail_from = _env("SMTP_FROM") or user
    use_ssl = _env("SMTP_USE_SSL", "true" if port == 465 else "false").lower() in {
        "1", "true", "yes", "on",
    }
    use_tls = _env("SMTP_USE_TLS", "true" if port == 587 else "false").lower() in {
        "1", "true", "yes", "on",
    }

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = mail_from
    msg["To"] = to
    msg.set_content(body)

    try:
        if use_ssl:
            with smtplib.SMTP_SSL(host, port, timeout=30) as server:
                server.login(user, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=30) as server:
                if use_tls:
                    server.starttls()
                server.login(user, password)
                server.send_message(msg)
        logger.info("EMAIL sent ok to=%s", to)
        return True
    except Exception:
        logger.exception("EMAIL send failed to=%s subject=%r", to, subject)
        return False


def club_confirm_email_body(responsible_name: Optional[str], full_name: str, confirm_link: str) -> str:
    name = responsible_name or "коллега"
    return (
        f"Здравствуйте, {name}!\n\n"
        f"Для завершения регистрации клуба «{full_name}» подтвердите email, перейдя по ссылке:\n"
        f"{confirm_link}\n\n"
        f"После подтверждения заявка будет передана администратору соревнования на одобрение.\n\n"
        f"— СпортДок"
    )
