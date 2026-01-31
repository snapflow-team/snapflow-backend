FROM node:22.22.0-alpine

ARG service
ARG port

ENV SERVICE=${service}
ENV PORT=${port}
ENV NODE_ENV=production

RUN corepack enable pnpm

# ⬇️ ВАЖНО: создаём и меняем владельца КАК root
RUN mkdir -p /home/node/app \
 && chown -R node:node /home/node/app

USER node
WORKDIR /home/node/app

COPY --chown=node package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY --chown=node . .

RUN pnpm run build:${SERVICE}

EXPOSE ${PORT}

CMD ["pnpm", "run", "start:prod:snapflow-core"]
