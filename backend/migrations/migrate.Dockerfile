FROM golang:1.23-alpine AS builder

WORKDIR /app
COPY . .
RUN go build -o /migrator ./backend/migrations/main.go

FROM alpine:latest

RUN apk add --no-cache postgresql-client

WORKDIR /app

COPY --from=builder /migrator /app/migrator
COPY ./backend/migrations /app/migrations

ENV MIGRATION_DIR=/app/migrations

ENTRYPOINT ["/bin/sh", "-c"]
CMD ["/app/init_db.sh"]
