FROM node:22.23.2-bookworm-slim@sha256:48e4b67d85f87bd551df43704e24d252f56cc5f8e9718841aace50f19948f0f9
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY models ./models
COPY routes ./routes
COPY services ./services
COPY utils ./utils
COPY views ./views
COPY public ./public
USER node
EXPOSE 3000
CMD ["node","server.js"]
