FROM node:20-alpine

WORKDIR /app
COPY . .

ENV DATA_DIR=/data
EXPOSE 8787
VOLUME ["/data"]

CMD ["node", "server/server.js"]
