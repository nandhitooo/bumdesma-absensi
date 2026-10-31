# Build context = root monorepo (lihat docker-compose.yml), karena npm
# workspaces menaruh seluruh dependency di satu node_modules di root.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
# devDependency ikut di-install: sequelize-cli dipakai service `migrate`.
RUN npm ci --workspace backend && npm cache clean --force

FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY backend/package.json ./backend/
COPY backend/server.js backend/.sequelizerc ./backend/
COPY backend/src ./backend/src
COPY backend/scripts ./backend/scripts
COPY backend/docs ./backend/docs
# Folder tulis (upload surat izin & QR) harus bisa diakses user non-root.
RUN mkdir -p /app/backend/uploads && chown -R node:node /app
USER node
WORKDIR /app/backend
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
