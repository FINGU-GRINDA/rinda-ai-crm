FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm i && npm run build

FROM node:20-alpine AS production
RUN npm install -g serve
COPY --from=builder /app/dist /app
WORKDIR /app
EXPOSE 3000
CMD ["serve", "-s", ".", "-l", "3000"]