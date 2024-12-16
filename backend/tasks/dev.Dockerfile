FROM golang:1.23-alpine

WORKDIR /app

RUN mkdir -p /app/tmp /app/bin
RUN go install github.com/air-verse/air@v1.61.0

COPY backend/tasks/ /app/backend/tasks/
COPY backend/tasks/go.mod backend/tasks/go.sum ./
RUN go mod download

CMD ["air", "-c", ".tasks.air.toml"]
