FROM node:22.22.0-alpine

ARG service
ARG port

ENV SERVICE=${service}
ENV PORT=${port}
ENV NODE_ENV=production
ENV HOME=/home/node

# 1️⃣ Устанавливаем pnpm КАК root
RUN npm install -g pnpm@10

# 2️⃣ Готовим рабочую директорию
RUN mkdir -p /home/node/app \
 && chown -R node:node /home/node

USER node
WORKDIR /home/node/app

# 3️⃣ зависимости
COPY --chown=node package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 4️⃣ исходники
COPY --chown=node . .

# 5️⃣ билд
RUN pnpm run build:${SERVICE}

EXPOSE ${PORT}

CMD ["pnpm", "run", "start:prod:snapflow-core"]
