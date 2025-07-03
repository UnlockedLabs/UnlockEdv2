FROM golang:1.20-alpine AS build

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo \
    -o provider-service provider-middleware/.

FROM scratch
COPY --from=build /src/provider-service /provider-service
ENTRYPOINT ["/provider-service"]
