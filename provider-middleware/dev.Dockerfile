ARG GOLANG_VERSION=1.26.10

FROM golang:$GOLANG_VERSION-alpine as builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o provider-service provider-middleware/.


FROM golang:$GOLANG_VERSION-alpine as final
WORKDIR /app
RUN go install github.com/air-verse/air@v1.61.0 && \
	apk add --no-cache ca-certificates

COPY --from=builder /app/provider-service /usr/bin/

ENV PATH="/usr/bin:${PATH}"
EXPOSE 8081
CMD ["air", "-c", ".middleware.air.toml"]
