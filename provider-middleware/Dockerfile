FROM golang:1.22.3-alpine as builder
WORKDIR /app/
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o provider-service .

FROM alpine:latest
COPY --from=builder /app/provider-service .
RUN mkdir logs && touch logs/provider-middleware.log
RUN mkdir -p provider-middleware
EXPOSE 8081
ENTRYPOINT ["./provider-service"]
