FROM node:22.13.1-bookworm-slim AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY contracts/package.json contracts/package.json
COPY backend/package.json backend/package.json
COPY worker/package.json worker/package.json
COPY ai-orchestration/package.json ai-orchestration/package.json
COPY legacy/package.json legacy/package.json
RUN npm ci --ignore-scripts
COPY tsconfig.service.json ./
COPY contracts contracts
RUN npm run build -w @wardrobe/contracts
COPY backend backend
RUN npm run build -w @wardrobe/backend

FROM node:22.13.1-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3001 HOSTNAME=0.0.0.0
WORKDIR /app
RUN useradd --create-home --uid 10001 wardrobe
COPY --from=build --chown=wardrobe:wardrobe /workspace/backend/.next/standalone ./
COPY --from=build --chown=wardrobe:wardrobe /workspace/backend/.next/static ./backend/.next/static
USER wardrobe
EXPOSE 3001
CMD ["node", "backend/server.js"]
