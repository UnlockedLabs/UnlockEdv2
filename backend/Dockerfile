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

RUN cd /opt/jasperstarter && \
    wget -O jasperstarter.jar https://repo1.maven.org/maven2/de/cenote/jasperstarter/3.6.2/jasperstarter-3.6.2.jar && \
    wget -O jasperstarter-bin.zip https://sourceforge.net/projects/jasperstarter/files/3.6.2/jasperstarter-3.6.2-bin.zip/download && \
    unzip jasperstarter-bin.zip && \
    mv jasperstarter-3.6.2/lib lib && \
    rm -rf jasperstarter-3.6.2 jasperstarter-bin.zip

ENV PATH="/opt/jasperstarter/bin:${PATH}"

COPY --from=builder /app/backend /backend
COPY --from=builder /app/backend/src/templates /templates
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder /usr/local/go/lib/time/zoneinfo.zip /

ENV ZONEINFO=/zoneinfo.zip
COPY --from=builder /app/migrations /migrations

EXPOSE 8080
ENTRYPOINT ["/backend"]
