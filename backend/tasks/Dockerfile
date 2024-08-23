FROM golang:1.23.0-alpine as builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o cron-tasks ./backend/tasks/.

FROM scratch
WORKDIR /
COPY --from=builder /app/cron-tasks .
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
ENTRYPOINT ["./cron-tasks"]
