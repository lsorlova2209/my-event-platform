FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY sportdok-backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# app.documents ищет шаблоны в <repo>/docs/samples относительно parents[2] от app/documents.py
# (/app/app/documents.py → / → /docs/samples)
COPY sportdok-backend/ .
COPY docs /docs

ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
