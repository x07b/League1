FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci && npx playwright install --with-deps chromium
COPY worker ./worker
COPY shared ./shared
COPY lib ./lib
COPY teams.json ./
ENV PORT=8080
EXPOSE 8080
CMD ["node", "worker/server.js"]
