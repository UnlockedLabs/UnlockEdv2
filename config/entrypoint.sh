#!/bin/ash
/usr/lib/squid/security_file_certgen -c -s /var/cache/squid/ssl_db -M 4MB
chown -R squid:squid /var/cache/squid/ssl_db /var/log/squid
squid -NYCd 1 -f /etc/squid/squid.conf
