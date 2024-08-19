FROM golang:1.23.0-alpine as builder

WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o provider-service provider-middleware/.

FROM scratch as final
COPY --from=builder /app/provider-service .
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
EXPOSE 8081
ENTRYPOINT ["./provider-service"]
