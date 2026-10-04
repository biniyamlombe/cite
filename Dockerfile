# Cite API — Hono server with pack corpus + checked-in outputs
FROM node:22-bookworm-slim

WORKDIR /app

# Install workspace deps (shared + backend only)
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
RUN npm ci --omit=dev --workspace=shared --workspace=backend

COPY shared ./shared
COPY backend ./backend
COPY data ./data
COPY outputs ./outputs

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# Build shared types/JS for workspace import
RUN npm run build -w shared

CMD ["npm", "run", "start", "-w", "backend"]
