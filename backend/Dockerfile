FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8001
COPY package.json ./
COPY src ./src
COPY examples ./examples
COPY openapi.json ./
USER node
EXPOSE 8001
CMD ["node", "src/server.mjs"]
