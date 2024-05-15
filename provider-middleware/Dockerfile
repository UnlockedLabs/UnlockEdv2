FROM golang:1.22.3-alpine as builder
WORKDIR /app/
COPY ./provider-middleware/go.mod ./provider-middleware/go.sum ./provider-middleware/
COPY ./provider-middleware/. ./provider-middleware/
COPY ./src .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o provider-service .

FROM alpine:latest
WORKDIR /
COPY --from=builder /app/provider-service .
EXPOSE 8081
ENTRYPOINT ["./provider-service"]
