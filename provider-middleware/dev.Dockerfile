ARG FFMPEG_VERSION=7.1
ARG GOLANG_VERSION=1.25.5

FROM mwader/static-ffmpeg:$FFMPEG_VERSION AS ffmpeg

FROM golang:$GOLANG_VERSION-alpine as builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o provider-service provider-middleware/. 


FROM golang:$GOLANG_VERSION-alpine as final
WORKDIR /app
RUN go install github.com/air-verse/air@v1.61.0 && \
	apk add --no-cache ca-certificates python3 py3-pip nodejs && \
	pip install --break-system-packages requests brotli websockets certifi yt-dlp[default,curl-cffi] yt-dlp-ejs

# Global yt-dlp config, auto-read on every invocation (goutubedl info-fetch + the download exec).
# - node runs YouTube's n-sig/EJS JS challenge (deno's release binary is glibc-only, won't run on musl/alpine).
# - web_safari client avoids the GVS PO-token 403 on adaptive formats.
RUN printf -- '--js-runtimes node\n--extractor-args youtube:player_client=web_safari\n' > /etc/yt-dlp.conf

COPY --from=builder /app/provider-service /usr/bin/
COPY --from=ffmpeg /ffmpeg /ffprobe /usr/bin/

ENV PATH="/usr/bin:${PATH}"
EXPOSE 8081
CMD ["air", "-c", ".middleware.air.toml"]
