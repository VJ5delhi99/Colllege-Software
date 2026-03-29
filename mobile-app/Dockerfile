FROM node:22-bookworm-slim

WORKDIR /app

COPY mobile-app/package.json mobile-app/package-lock.json ./
RUN npm ci

COPY mobile-app/ ./

EXPOSE 3001

CMD ["npm", "run", "web", "--", "--host", "lan", "--port", "3001", "--non-interactive"]
