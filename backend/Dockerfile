FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm i -g openclaw

COPY . .
EXPOSE 8787
CMD ["npm", "start"]
