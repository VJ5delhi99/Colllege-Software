FROM node:22-bookworm-slim

WORKDIR /app

COPY web-admin/package.json web-admin/package-lock.json ./
RUN npm ci

COPY web-admin/ ./

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]
