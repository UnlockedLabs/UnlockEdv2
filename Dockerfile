FROM golang:1.22.2-alpine as builder
WORKDIR /app/
COPY go.mod go.sum ./
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o backend Go-Prototype/backend

FROM node:21-alpine3.19 as frontend
WORKDIR /app/
COPY frontend/. ./
RUN npm install yarn
RUN yarn install
RUN yarn run build

FROM alpine:latest
COPY --from=builder /app/backend ./
COPY --from=frontend /app/dist ./frontend/dist
RUN mkdir logs && touch logs/server.log
EXPOSE 8080
ENTRYPOINT ["./backend"]
