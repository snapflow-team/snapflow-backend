FROM node:22.22.0-alpine

ARG service
ARG port

ENV SERVICE=${service}
ENV PORT=${port}
ENV NODE_ENV=production

RUN corepack enable pnpm

USER node

WORKDIR /home/node/app

# 1️⃣ package manager
COPY --chown=node package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 2️⃣ весь проект
COPY --chown=node . .

# 3️⃣ билд конкретного сервиса
RUN pnpm run build:${SERVICE}

# 4️⃣ prisma (если нужно)
RUN pnpm run prisma:generate:prod:${SERVICE} \
 && pnpm run prisma:deploy:${SERVICE}

EXPOSE ${PORT}

# 5️⃣ запуск
CMD ["pnpm", "run", "start:prod:snapflow-core"]
