FROM node:22-alpine AS worker

RUN apk add --no-cache git ca-certificates

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY worker ./worker
COPY src ./src

ENV NODE_ENV=production
USER node

CMD ["npm", "run", "worker:start"]
