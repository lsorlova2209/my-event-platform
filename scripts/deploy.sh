#!/usr/bin/env bash
set -euo pipefail

cd /opt/my-event-platform

echo "==> Обновление кода из GitHub..."
git fetch origin main
CHANGED_FILES="$(git diff --name-only HEAD..origin/main || true)"

if [[ -z "${CHANGED_FILES}" ]]; then
    echo "==> Новых изменений нет."
    exit 0
fi

echo "==> Изменённые файлы:"
printf '%s\n' "${CHANGED_FILES}"

NEEDS_API=0
NEEDS_WEB=0

if printf '%s\n' "${CHANGED_FILES}" | rg "^(sportdok-backend/|docker-compose\.prod\.yml$)"; then
    NEEDS_API=1
fi

if printf '%s\n' "${CHANGED_FILES}" | rg "^(sportdok-frontend/|docker-compose\.prod\.yml$|certbot-www/)"; then
    NEEDS_WEB=1
fi

git reset --hard origin/main

if [[ "${NEEDS_API}" -eq 0 && "${NEEDS_WEB}" -eq 0 ]]; then
    echo "==> В рантайме ничего не поменялось, пересборка не нужна."
    docker compose -f docker-compose.prod.yml ps
    exit 0
fi

echo "==> Пересборка и перезапуск изменённых сервисов..."
export DOCKER_BUILDKIT=0

SERVICES=()
if [[ "${NEEDS_API}" -eq 1 ]]; then
    SERVICES+=("api")
fi
if [[ "${NEEDS_WEB}" -eq 1 ]]; then
    SERVICES+=("web")
fi

docker compose -f docker-compose.prod.yml up -d --build "${SERVICES[@]}"

echo "==> Статус:"
docker compose -f docker-compose.prod.yml ps

echo "==> Готово."
