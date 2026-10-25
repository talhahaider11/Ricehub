FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential \
       libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000



CMD ["sh", "-c", "python manage.py shell -c \"from django.db import connection; c=connection.cursor(); c.execute('SELECT current_database(), current_schema(), current_user'); print('DB CHECK:', c.fetchone()); c.execute(\\\"SELECT table_schema, table_name FROM information_schema.tables WHERE table_name IN ('users_user', 'django_migrations')\\\"); print('TABLE CHECK:', c.fetchall())\" && python manage.py migrate --noinput && python manage.py collectstatic --noinput && daphne -b 0.0.0.0 -p ${PORT:-10000} config.asgi:application"]
