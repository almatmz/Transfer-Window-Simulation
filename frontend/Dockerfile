FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/.next ./.next

RUN mkdir -p /app/public
COPY --from=builder /app/publi[c] /app/public/

EXPOSE 3000

CMD ["npm", "start"]