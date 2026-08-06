FROM docker.io/library/node:20-slim

# Keep OpenSSL installed for runtime execution
RUN apt-get update -y && apt-get install -y openssl ca-certificates

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 8080

# Ensure it uses npm start to trigger the migration chain at runtime
CMD ["npm", "run", "start"]