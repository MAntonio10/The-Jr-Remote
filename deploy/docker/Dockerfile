FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/index.js ./
USER node
CMD ["node", "index.js"]
