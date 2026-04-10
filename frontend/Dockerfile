# Stage 1 – Build
FROM node:20-alpine AS builder

WORKDIR /app

# Build-time environment variables (baked into the static JS bundle by Vite)
ARG VITE_KEYCLOAK_URL=/auth
ARG VITE_KEYCLOAK_REALM=warehouse
ARG VITE_KEYCLOAK_CLIENT=warehouse-app
ARG VITE_API_URL=/api

ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL
ENV VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM
ENV VITE_KEYCLOAK_CLIENT=$VITE_KEYCLOAK_CLIENT
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci --frozen-lockfile

COPY . .
RUN npm run build

# Stage 2 – Runtime (nginx serves the static files)
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# SPA fallback: all routes → index.html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
