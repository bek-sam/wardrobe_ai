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
COPY worker worker
RUN npm run build -w @wardrobe/contracts && npm run build -w @wardrobe/worker

FROM node:22.13.1-bookworm-slim AS runtime-dependencies
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY contracts/package.json contracts/package.json
COPY backend/package.json backend/package.json
COPY worker/package.json worker/package.json
COPY ai-orchestration/package.json ai-orchestration/package.json
COPY legacy/package.json legacy/package.json
RUN npm ci --ignore-scripts --omit=dev --workspace @wardrobe/contracts --workspace @wardrobe/worker --include-workspace-root=false

FROM node:22.13.1-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN useradd --create-home --uid 10001 wardrobe
COPY --from=runtime-dependencies --chown=wardrobe:wardrobe /workspace/node_modules ./node_modules
COPY --from=runtime-dependencies --chown=wardrobe:wardrobe /workspace/worker/node_modules ./worker/node_modules
COPY --from=build --chown=wardrobe:wardrobe /workspace/contracts/dist ./contracts/dist
COPY --from=build --chown=wardrobe:wardrobe /workspace/contracts/package.json ./contracts/package.json
COPY --from=build --chown=wardrobe:wardrobe /workspace/worker/dist ./worker/dist
COPY --from=build --chown=wardrobe:wardrobe /workspace/worker/package.json ./worker/package.json
USER wardrobe
CMD ["node", "worker/dist/main.js"]
