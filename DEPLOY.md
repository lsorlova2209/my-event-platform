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

Сертификат на **хосте** (без Docker Hub), nginx только монтирует `/etc/letsencrypt`, а проверки Let's Encrypt идут через `webroot` без остановки сайта.

```bash
# порт 443
ufw allow 443/tcp

# поставить certbot
apt-get update
apt-get install -y certbot

# webroot для challenge-файлов
cd /opt/my-event-platform
mkdir -p certbot-www/.well-known/acme-challenge

certbot certonly --webroot \
  -w /opt/my-event-platform/certbot-www \
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

Автопродление сертификата без ручных действий:

```bash
cd /opt/my-event-platform

# скрипт продления
cat >/usr/local/bin/sportdok-renew-cert.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
certbot renew --webroot -w /opt/my-event-platform/certbot-www
cd /opt/my-event-platform
docker compose -f docker-compose.prod.yml exec web nginx -s reload
EOF

chmod +x /usr/local/bin/sportdok-renew-cert.sh

# ежедневный cron: проверка в 03:17
cat >/etc/cron.d/sportdok-cert-renew <<'EOF'
17 3 * * * root /usr/local/bin/sportdok-renew-cert.sh >> /var/log/sportdok-cert-renew.log 2>&1
EOF

chmod 644 /etc/cron.d/sportdok-cert-renew
```

## 5. Обновление после правок в GitHub

Вручную на сервере:

```bash
cd /opt/my-event-platform
bash scripts/deploy.sh
```

Или включи **автодеплой** (см. раздел 6).

Скрипт `scripts/deploy.sh` сам:

- подтягивает `origin/main`
- смотрит, какие файлы изменились
- пересобирает только `api` и/или `web`, если это нужно
- не трогает `postgres`, если менялись только docs / workflow

Если снова `429 Too Many Requests` — `docker login` на сервере.

## 6. Автодеплой из GitHub Actions

После `git push` в ветку `main` сайт обновляется сам (workflow `.github/workflows/deploy.yml`).

### Один раз: SSH-ключ только для деплоя

**На своём компьютере** (PowerShell):

```powershell
ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\sportdok_deploy -N '""'
```

Публичный ключ добавь на сервер:

```powershell
type $env:USERPROFILE\.ssh\sportdok_deploy.pub | ssh root@217.149.19.36 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

(Введи пароль root с Timeweb.)

Проверка входа по ключу:

```powershell
ssh -i $env:USERPROFILE\.ssh\sportdok_deploy root@217.149.19.36 "echo ok"
```

Должно вывести `ok` без запроса пароля.

### Один раз: секреты в GitHub

Репозиторий → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Имя | Значение |
|-----|----------|
| `DEPLOY_HOST` | `217.149.19.36` |
| `DEPLOY_USER` | `root` |
| `DEPLOY_SSH_KEY` | содержимое файла `sportdok_deploy` (приватный ключ, целиком) |

Приватный ключ скопировать:

```powershell
Get-Content $env:USERPROFILE\.ssh\sportdok_deploy -Raw
```

Вставь в секрет `DEPLOY_SSH_KEY` — от `-----BEGIN` до `-----END` включительно.

### Проверка

1. Закоммить и запушить любое изменение в `main`.
2. На GitHub: вкладка **Actions** — workflow **Deploy to production** должен стать зелёным.
3. Сайт: https://sportdoc24.ru

Ручной запуск: **Actions** → **Deploy to production** → **Run workflow**.

### Если деплой упал с 429 (Docker Hub)

На сервере по SSH:

```bash
docker login
```

Подожди 10–15 минут и на GitHub нажми **Re-run failed jobs**.

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

- автопродление домена в Timeweb
