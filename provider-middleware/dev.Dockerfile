ARG YT_DLP=2024.10.22
# ARG FFMPEG_VERSION=7.1
ARG GOLANG_VERSION=1.23.2
# FROM mwader/static-ffmpeg:$FFMPEG_VERSION AS ffmpeg

FROM golang:$GOLANG_VERSION AS yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/download/$YT_DLP/yt-dlp -o /yt-dlp && chmod a+x /yt-dlp

FROM golang:$GOLANG_VERSION-alpine as builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o provider-service provider-middleware/.

FROM alpine:3.20.3 as final
COPY --from=builder /app/provider-service /usr/bin/
# COPY --from=ffmpeg /ffmpeg /ffprobe /usr/bin
COPY --from=yt-dlp /yt-dlp /usr/bin

ENV PATH="/usr/bin:${PATH}"
EXPOSE 8081
CMD ["air", "-c", ".middleware.air.toml"]
