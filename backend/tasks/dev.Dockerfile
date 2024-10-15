FROM golang:1.23-alpine

WORKDIR /app

RUN go install github.com/air-verse/air@latest

COPY backend/tasks/go.mod backend/tasks/go.sum ./
RUN go mod download
CMD ["air", "-c", ".tasks.air.toml"]
