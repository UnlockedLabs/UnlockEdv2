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
ENTRYPOINT ["entrypoint/entrypoint.sh"]
CMD ["squid", "-NYCd", "1"]
