#!/usr/bin/env bash
set -euo pipefail

cd /opt/my-event-platform

echo "==> Обновление кода из GitHub..."
git fetch origin main
git reset --hard origin/main

echo "==> Пересборка и перезапуск контейнеров..."
export DOCKER_BUILDKIT=0
docker compose -f docker-compose.prod.yml up -d --build

echo "==> Статус:"
docker compose -f docker-compose.prod.yml ps

echo "==> Готово."
