FROM alpine:latest

RUN apk add --no-cache \
	squid \
	gettext \
	libressl \
	ca-certificates && \
	update-ca-certificates

RUN mkdir -p /etc/squid/ssl_cert /var/cache/squid/ /var/spool/squid /var/log/squid/ && \
	chown -R squid:squid /etc/squid/ssl_cert /var/cache/squid/ /var/log/squid/ /var/spool/squid

EXPOSE 3128

RUN /usr/lib/squid/security_file_certgen -c -s /var/cache/squid/ssl_db -M 4MB \
	&& touch /var/run/squid.pid && chown -R squid:squid /var/cache/squid/ssl_db /var/log/squid /var/run/squid.pid
CMD ["squid", "-NYCd","1", "-f","/etc/squid/squid.conf"]
