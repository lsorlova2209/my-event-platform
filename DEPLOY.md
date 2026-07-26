# Деплой СпортДок на VPS (Timeweb)

Сайт открывается по `http://IP` (пока без домена и HTTPS).

## Что нужно на сервере

- Ubuntu 24.04
- Docker + Docker Compose plugin
- Открыт порт **80** (SSH 22 уже есть)

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
- `FRONTEND_URL` и `CORS_ORIGINS` на свой IP, например `http://217.149.19.36`

Сгенерировать SECRET_KEY:

```bash
openssl rand -hex 32
```

## 2. Firewall (если включён ufw)

```bash
ufw allow OpenSSH
ufw allow 80/tcp
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

В браузере открой: `http://217.149.19.36`

Логин админа по умолчанию (смени после входа): `admin@sportdok.ru` / `admin123`

## 4. Обновление после правок в GitHub

```bash
cd /opt/my-event-platform
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## Полезные команды

```bash
# логи API
docker compose -f docker-compose.prod.yml logs -f api

# логи nginx/фронта
docker compose -f docker-compose.prod.yml logs -f web

# остановить
docker compose -f docker-compose.prod.yml down
```

## Дальше (не сейчас)

- домен → A-запись на IP сервера
- HTTPS (Let's Encrypt / certbot)
- автодеплой из GitHub Actions
