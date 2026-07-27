# Деплой СпортДок на VPS (Timeweb)

Прод: `https://sportdoc24.ru` (nginx + Let's Encrypt).

## Что нужно на сервере

- Ubuntu 24.04
- Docker + Docker Compose plugin
- Открыты порты **80** и **443** (SSH 22 уже есть)

## 1. На сервере: клон и .env

```bash
cd /opt
git clone https://github.com/lsorlova2209/my-event-platform.git
cd my-event-platform
cp .env.example .env
nano .env
```

Обязательно смени:

- `POSTGRES_PASSWORD`
- `SECRET_KEY` (длинная случайная строка)
- `FRONTEND_URL` и `CORS_ORIGINS` на домен, например `https://sportdoc24.ru`

Сгенерировать SECRET_KEY:

```bash
openssl rand -hex 32
```

## 2. Firewall (если включён ufw)

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

## 3. Сборка и запуск

```bash
cd /opt/my-event-platform
docker compose -f docker-compose.prod.yml up -d --build
```

Первый раз может занять несколько минут (скачивание образов).

Проверка:

```bash
docker compose -f docker-compose.prod.yml ps
curl -I http://127.0.0.1/
curl http://127.0.0.1/api/v1/tournaments/
```

В браузере: `https://sportdoc24.ru` (после шага с сертификатом ниже).

Логин админа при первом запуске: `admin@sportdok.ru` / `admin123` — сразу смени пароль на сервере (см. ниже).

Смена пароля админа (на сервере):

```bash
cd /opt/my-event-platform
docker compose -f docker-compose.prod.yml exec api python -c "
from app.database import SessionLocal
from app.models.user import User
from app.auth import hash_password
db = SessionLocal()
u = db.query(User).filter(User.email == 'admin@sportdok.ru').first()
u.password_hash = hash_password('НОВЫЙ_ПАРОЛЬ')
db.commit()
print('Пароль обновлён')
"
```

## 4. HTTPS (Let's Encrypt)

Сертификат на **хосте** (без Docker Hub), nginx только монтирует `/etc/letsencrypt`.

```bash
# порт 443
ufw allow 443/tcp

# поставить certbot
apt-get update
apt-get install -y certbot

# на минуту освободить порт 80
cd /opt/my-event-platform
docker compose -f docker-compose.prod.yml stop web

certbot certonly --standalone \
  -d sportdoc24.ru \
  --email ТВОЙ_EMAIL@example.com \
  --agree-tos \
  --non-interactive

# подтянуть актуальные nginx.conf + compose (если ещё не сделано)
git pull

# обновить CORS под https
nano .env
# FRONTEND_URL=https://sportdoc24.ru
# CORS_ORIGINS=https://sportdoc24.ru,http://sportdoc24.ru,http://217.149.19.36

docker compose -f docker-compose.prod.yml up -d --no-build --force-recreate web api
```

Продление сертификата (раз в ~2–3 месяца, можно cron):

```bash
cd /opt/my-event-platform
docker compose -f docker-compose.prod.yml stop web
certbot renew
docker compose -f docker-compose.prod.yml start web
```

## 5. Обновление после правок в GitHub

```bash
cd /opt/my-event-platform
git pull
# api/web: только если менялся код/зависимости; при лимите Docker Hub — см. ниже
DOCKER_BUILDKIT=0 docker compose -f docker-compose.prod.yml up -d --build
```

Если снова `429 Too Many Requests` — `docker login` на сервере, подождать или собирать с `DOCKER_BUILDKIT=0`.

## Полезные команды

```bash
# логи API
docker compose -f docker-compose.prod.yml logs -f api

# логи nginx/фронта
docker compose -f docker-compose.prod.yml logs -f web

# остановить
docker compose -f docker-compose.prod.yml down
```

## Дальше (по желанию)

- сменить пароль админа
- автопродление домена в Timeweb
- автодеплой из GitHub Actions
