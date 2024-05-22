FROM node:21-alpine3.19 as builder
WORKDIR /app/
COPY . .
RUN npm install yarn
RUN yarn install
RUN yarn run build

FROM nginx:1.21.3-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=builder /app/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
ENTRYPOINT ["nginx", "-g", "daemon off;"]
