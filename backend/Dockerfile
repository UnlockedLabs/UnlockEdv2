FROM golang:1.23.0-alpine as builder
WORKDIR /app/
COPY ./backend/go.mod ./backend/go.sum ./
COPY ./backend/. .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o backend .

FROM scratch
COPY --from=builder /app/backend ./
COPY --from=builder /app/migrations migrations
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
EXPOSE 8080
ENTRYPOINT ["./backend"]
