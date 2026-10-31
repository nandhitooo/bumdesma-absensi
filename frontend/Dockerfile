# Build context = root monorepo (lihat docker-compose.yml), karena npm
# workspaces menaruh seluruh dependency di satu node_modules di root.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci --workspace frontend && npm cache clean --force
COPY frontend ./frontend
# URL backend yang dipanggil browser. Default "/api" = same-origin, lalu
# diproksikan nginx ke container backend (tidak ada CORS, tidak ada localhost).
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build --workspace frontend

FROM nginx:1.27-alpine AS runner
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
