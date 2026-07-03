import logging

logger = logging.getLogger("sportdok.email")
logger.setLevel(logging.INFO)
if not logger.handlers:
    # Настраиваем логгер явно, а не полагаемся на root/uvicorn - иначе
    # при уровне WARNING по умолчанию письма молча пропадут из консоли.
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(asctime)s [%(name)s] %(message)s"))
    logger.addHandler(_handler)

# ТЗ §3.2/§7: email-уведомления - требование MVP, не версии 2 (подтверждение
# email клуба, уведомление админу о новой заявке, одобрение клуба,
# подтверждение по каждой регистрации участника). Реального SMTP/API-ключа
# для отправки почты нет и в ТЗ он не задан - вместо реальной отправки
# письмо логируется. Вся остальная логика (когда именно отправлять, кому,
# с каким содержанием) реализована по-настоящему - подключить реального
# провайдера значит заменить только тело этой функции.
def send_email(to: str, subject: str, body: str):
    logger.info("EMAIL to=%s subject=%r\n%s", to, subject, body)
