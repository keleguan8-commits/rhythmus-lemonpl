FROM node:24-bookworm-slim AS runtime
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY index.html style.css app.js library.js server.mjs ./
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=80
EXPOSE 80
CMD ["node", "server.mjs"]
