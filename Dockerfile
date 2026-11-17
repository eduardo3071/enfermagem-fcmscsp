# --- build do front-end -------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js postcss.config.js tailwind.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# --- runtime: o servidor não tem dependências (usa node:sqlite do Node 22) -----
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8080 \
    DB_PATH=/data/data.db \
    TRUST_PROXY=1
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY --from=build /app/dist ./dist
# /data é o volume persistente do SQLite; o usuário "node" precisa poder escrever nele
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "--no-warnings", "server/index.js"]
