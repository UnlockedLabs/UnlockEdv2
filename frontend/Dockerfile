FROM node:21-alpine3.19 as builder
WORKDIR /app/
COPY . .
RUN yarn && yarn build

FROM nginx:1.27.2-alpine-slim
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
ENTRYPOINT ["nginx", "-g", "daemon off;"]
