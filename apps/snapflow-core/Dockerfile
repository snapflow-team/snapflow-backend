FROM node:24.6-alpine
ARG port
ARG service
ENV SERVICE=snapflow-core
ENV PORT=4171

RUN corepack enable pnpm

USER node

RUN mkdir -p /home/node/dist/${SERVICE}

WORKDIR /home/node/dist/${SERVICE}

# копируем package.json и pnpm‑lock, чтобы слои кэшировались
COPY --chown=node package*.json ./
COPY --chown=node pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

# копируем prisma‑каталог и генерируем клиента
COPY --chown=node apps/$SERVICE/prisma ./apps/$SERVICE/prisma
RUN npx prisma generate --schema apps/${SERVICE}/prisma/schema.prisma

COPY --chown=node . .

EXPOSE ${PORT}

# запускаем продакшен‑скрипт
CMD ["pnpm", "run", "start:prod:$SERVICE"]