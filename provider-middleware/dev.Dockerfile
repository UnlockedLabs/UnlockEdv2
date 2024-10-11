FROM golang:1.23-alpine

WORKDIR /app

RUN go install github.com/air-verse/air@latest

COPY provider-middleware/go.mod provider-middleware/go.sum ./
RUN go mod download
EXPOSE 8081
CMD ["air", "-c", ".middleware.air.toml"]
