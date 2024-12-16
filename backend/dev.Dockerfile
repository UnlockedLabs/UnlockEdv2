FROM golang:1.23-alpine

WORKDIR /app

RUN go install github.com/air-verse/air@v1.61.0

COPY backend/go.mod backend/go.sum ./
RUN go mod download
EXPOSE 8080
CMD ["air", "-c", ".air.toml"]
