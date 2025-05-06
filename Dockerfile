FROM apify/actor-node-playwright:latest

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --omit=dev
COPY . ./