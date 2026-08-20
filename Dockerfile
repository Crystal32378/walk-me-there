FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# EXPOSE is just metadata
EXPOSE 8080
# Configure nginx to use the PORT environment variable
CMD ["sh", "-c", "sed -i 's/listen[[:space:]]*80;/listen '\"$PORT\"';/g' /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
