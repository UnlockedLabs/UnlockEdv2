ARG FFMPEG_VERSION=7.1
ARG GOLANG_VERSION=1.23.5

FROM mwader/static-ffmpeg:$FFMPEG_VERSION AS ffmpeg

FROM golang:$GOLANG_VERSION AS yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /yt-dlp && chmod a+x /yt-dlp

FROM golang:$GOLANG_VERSION-alpine as builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o provider-service provider-middleware/.


FROM alpine:3.20.3 as final
WORKDIR /app
RUN apk add --no-cache ca-certificates python3 py3-pip && \
	pip install --break-system-packages requests brotli websockets certifi yt-dlp[default,curl-cffi] && \
	mkdir -p $HOME/.config/yt-dlp

COPY --from=builder /app/provider-service /usr/bin/
COPY --from=ffmpeg /ffmpeg /ffprobe /usr/bin/
COPY --from=yt-dlp /yt-dlp /usr/bin/

ENV PATH="/usr/bin:${PATH}"

EXPOSE 8081
ENTRYPOINT ["/usr/bin/provider-service"]
