FROM golang:1.22.3-alpine as builder
WORKDIR /app/
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o provider-service .

FROM scratch
COPY --from=builder /app/provider-service .
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
EXPOSE 8081
ENTRYPOINT ["./provider-service"]
