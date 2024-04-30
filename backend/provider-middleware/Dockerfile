FROM golang:1.22.2-alpine as builder
WORKDIR /app
COPY go.mod go.sum ./
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o provider-service .

FROM alpine:latest
WORKDIR /root/
COPY --from=builder /app/provider-service .
EXPOSE 8081
CMD ["./provider-service"]
