# ── build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
RUN apk add --no-cache python3 py3-setuptools make g++
WORKDIR /app
COPY package.json package-lock.json* ./
COPY scripts ./scripts
RUN npm install
COPY . .
RUN npm run build && npm prune --omit=dev

# ── runtime ───────────────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=5360
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/package.json ./package.json
EXPOSE 5360
CMD ["node", "server/index.js"]
