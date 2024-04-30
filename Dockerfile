FROM golang:1.22.2-alpine as builder
WORKDIR /app/
COPY go.mod go.sum ./
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o backend Go-Prototype/backend

FROM alpine:latest
WORKDIR /
RUN apk add --no-cache netcat-openbsd
COPY --from=builder /app/backend .
RUN mkdir frontend
RUN mkdir frontend/public
COPY ./frontend/public/* /frontend/public/
EXPOSE 8080
ENTRYPOINT ["./backend"]
