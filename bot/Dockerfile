FROM mcr.microsoft.com/playwright:v1.62.1-jammy

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev
COPY bot.js server.js auth-setup.js .env.example ./

EXPOSE 3001

CMD ["node", "server.js"]
