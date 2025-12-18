FROM ghcr.io/unlockedlabs/golang-jasper:1.25-3.6.2 AS builder

WORKDIR /app
COPY ./backend/go.mod ./backend/go.sum ./
RUN go mod download

COPY ./backend/ ./

RUN CGO_ENABLED=0 GOOS=linux GOFLAGS=-mod=readonly go build -trimpath -o backend ./cmd/main.go

FROM ghcr.io/unlockedlabs/golang-jasper:1.25-3.6.2

COPY --from=builder /app/backend /backend
COPY --from=builder /app/src/templates /templates
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder /app/migrations /migrations

EXPOSE 8080
ENTRYPOINT ["/backend"]
