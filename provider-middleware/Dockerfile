FROM golang:1.22.3-alpine as builder
WORKDIR /app/
COPY ./provider-middleware/go.mod ./provider-middleware/go.sum ./provider-middleware/
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o provider-service ./provider-middleware/.

FROM alpine:latest
COPY --from=builder /app/provider-service .
RUN mkdir logs && touch logs/provider-middleware.log
RUN mkdir -p provider-middleware
RUN touch provider-middleware/providers.db
EXPOSE 8081
ENTRYPOINT ["./provider-service"]
