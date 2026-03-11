FROM node:22.22.0-alpine

ARG service
ARG port

ENV SERVICE=${service}
ENV PORT=${port}

# 1️⃣ pnpm
RUN npm install -g pnpm@10

# 2️⃣ директории
RUN mkdir -p /home/node/app \
 && chown -R node:node /home/node

USER node
WORKDIR /home/node/app

# 3️⃣ зависимости
COPY --chown=node package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 4️⃣ код
COPY --chown=node . .

# 🔥 5️⃣ prisma generate — ОБЯЗАТЕЛЬНО
RUN pnpm run prisma:generate:prod:${SERVICE}
RUN pnpm run build:${SERVICE}
RUN mkdir -p apps/files/dist/generated/files && \
    cp -r apps/files/generated/prisma/* apps/files/dist/generated/files/prisma/
es/generated apps/files/dist/


# 6️⃣ build
#RUN pnpm run build:${SERVICE}

EXPOSE ${PORT}

CMD ["pnpm", "run", "start:prod:files"]
