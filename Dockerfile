# Cite API — Hono server with pack corpus + checked-in outputs
FROM node:22-bookworm-slim

WORKDIR /app

# Install workspace deps (tsx + tsc needed to run/build TypeScript sources)
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
RUN npm ci --workspace=shared --workspace=backend

COPY shared ./shared
COPY backend ./backend
COPY data ./data
COPY outputs ./outputs

ENV NODE_ENV=production
# Cloud Run sets PORT; default locally / other hosts
ENV PORT=8080
EXPOSE 8080

# Build shared package for workspace import
RUN npm run build -w shared

CMD ["npm", "run", "start", "-w", "backend"]
