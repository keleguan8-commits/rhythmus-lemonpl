FROM harbor.qihoo.net/xny-ztzcb-finer-library/fw-node:24.18.0 AS runtime
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --registry=https://registry.qnpm.qihoo.net
COPY index.html style.css app.js library.js server.mjs ./
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=80
EXPOSE 80
CMD ["node", "server.mjs"]
