FROM golang:1.25-alpine as builder

WORKDIR /app
COPY ./backend/go.mod ./backend/go.sum ./
RUN go mod download

COPY ./backend/ ./

RUN CGO_ENABLED=0 GOOS=linux GOFLAGS=-mod=readonly go build -trimpath -o backend ./cmd/main.go

FROM scratch

COPY --from=builder /app/backend /backend
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder /usr/local/go/lib/time/zoneinfo.zip /

ENV ZONEINFO=/zoneinfo.zip
COPY --from=builder /app/migrations /migrations

EXPOSE 8080
ENTRYPOINT ["/backend"]
