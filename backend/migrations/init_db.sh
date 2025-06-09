#!/bin/sh
set -e

echo "Running init.sql to create users and databases..."
PGPASSWORD="$DB_ADMIN_PASSWORD" psql -h "$DB_HOST" -U "$DB_ADMIN_USER" -f /app/init postgres

echo "Running goose migrations..."
exec /app/migrator
