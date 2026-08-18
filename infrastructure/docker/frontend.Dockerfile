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
COPY next-env.d.ts next.config.ts postcss.config.mjs tsconfig.json ./
COPY public public
COPY src src
RUN npm run build

FROM node:22.13.1-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN useradd --create-home --uid 10001 wardrobe
COPY --from=build --chown=wardrobe:wardrobe /workspace/.next/standalone ./
COPY --from=build --chown=wardrobe:wardrobe /workspace/.next/static ./.next/static
COPY --from=build --chown=wardrobe:wardrobe /workspace/public ./public
USER wardrobe
EXPOSE 3000
CMD ["node", "server.js"]
