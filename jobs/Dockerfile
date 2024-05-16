FROM golang:1.22.3-alpine as builder
WORKDIR /app
COPY ./jobs/go.mod ./jobs/go.sum ./jobs/
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o cron ./jobs/.

FROM alpine:latest
COPY --from=builder ./app/cron .
RUN mkdir logs && touch logs/jobs.log
ENTRYPOINT ["/cron"]
