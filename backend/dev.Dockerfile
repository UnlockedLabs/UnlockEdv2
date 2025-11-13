# Build stage
FROM golang:1.23.0-alpine as builder

WORKDIR /app
COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -o backend ./cmd/main.go

# Runtime stage with Java and JasperStarter
FROM eclipse-temurin:17-jre-alpine

# Install development dependencies
RUN apk add --no-cache \
    git \
    curl \
    unzip \
    bash \
    fontconfig \
    ttf-freefont \
    ttf-liberation \
    ttf-dejavu

# Update font cache for Java applications
RUN fc-cache -fv

# Install Go for development tools
ENV GOLANG_VERSION=1.23.0
RUN wget -O - https://storage.googleapis.com/golang/go${GOLANG_VERSION}.linux-amd64.tar.gz | tar -C /usr/local -xzf -
ENV PATH="/usr/local/go/bin:${PATH}"
ENV GOPATH="/root/go"
ENV PATH="${GOPATH}/bin:${PATH}"

# Install development tools
RUN go install github.com/air-verse/air@v1.61.0
RUN go install github.com/go-delve/delve/cmd/dlv@latest

# Setup JasperStarter
RUN mkdir -p /opt/jasperstarter && \
    echo '#!/bin/bash\nexec java -jar /opt/jasperstarter/jasperstarter.jar "$@"' > /opt/jasperstarter/jasperstarter && \
    chmod +x /opt/jasperstarter/jasperstarter

# Copy local JasperStarter JAR
COPY jasperstarter/jasperstarter/lib/jasperstarter.jar /opt/jasperstarter/jasperstarter.jar

# Copy JasperStarter libraries
COPY jasperstarter/jasperstarter/lib /opt/jasperstarter/lib

ENV PATH="/opt/jasperstarter:/usr/local/go/bin:${GOPATH}/bin:${PATH}"

WORKDIR /app

# Copy the built application
COPY --from=builder /app/backend /app/backend
# Copy template from backend/src/templates
COPY backend/src/templates/user_usage_report.jrxml /templates/user_usage_report.jrxml
COPY backend/go.mod backend/go.sum ./
COPY backend/.air.toml ./

EXPOSE 8080
CMD ["air", "-c", ".air.toml"]
