FROM node:18

WORKDIR /excalidraw-room

COPY package.json yarn.lock ./
RUN yarn

COPY . .
RUN yarn build
