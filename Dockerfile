FROM node:22-slim
WORKDIR /app
COPY server.js ./
COPY public ./public
ENV PORT=8080 DATA_DIR=/data
EXPOSE 8080
USER node
CMD ["node", "server.js"]
