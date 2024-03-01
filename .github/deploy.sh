#!/bin/bash

cd /var/www/html

git fetch origin main
git reset --hard origin/main

composer install --no-interaction --prefer-dist --optimize-autoloader

php artisan migrate --force

php artisan config:cache
php artisan route:cache
php artisan view:cache

sudo chmod 750 -R storage bootstrap/cache
sudo chown apache:apache -R storage bootstrap/cache
sudo chmod 640 storage/oauth-private.key
sudo chmod 775 storage/logs/laravel.log
