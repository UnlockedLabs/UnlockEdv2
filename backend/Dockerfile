FROM golang:1.22.3-alpine as builder
WORKDIR /app/
COPY ./backend/go.mod ./backend/go.sum ./
COPY ./backend/. .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o backend .

FROM scratch
COPY --from=builder /app/backend ./
EXPOSE 8080
ENTRYPOINT ["./backend"]
