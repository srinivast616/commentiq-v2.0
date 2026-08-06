FROM node:20-slim AS base

RUN apt-get update -y && apt-get install -y openssl ca-certificates

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
