FROM golang:1.23.0-alpine as builder

WORKDIR /app
COPY ./backend/go.mod ./backend/go.sum ./
RUN go mod download

COPY ./backend/ ./

RUN CGO_ENABLED=0 GOOS=linux GOFLAGS=-mod=readonly go build -trimpath -o backend ./cmd/main.go

FROM eclipse-temurin:17-jre-alpine

RUN apk add --no-cache \
    curl \
    unzip \
    bash

RUN mkdir -p /opt/jasperstarter && \
    echo '#!/bin/bash\nexec java -jar /opt/jasperstarter/jasperstarter.jar "$@"' > /opt/jasperstarter/jasperstarter && \
    chmod +x /opt/jasperstarter/jasperstarter

COPY ./jasperstarter/jasperstarter.jar /opt/jasperstarter/

ENV PATH="/opt/jasperstarter/bin:${PATH}"

COPY --from=builder /app/backend /backend
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder /usr/local/go/lib/time/zoneinfo.zip /

ENV ZONEINFO=/zoneinfo.zip
COPY --from=builder /app/migrations /migrations

EXPOSE 8080
ENTRYPOINT ["/backend"]
