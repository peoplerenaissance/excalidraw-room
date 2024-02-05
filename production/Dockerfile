FROM node:18-slim

RUN apt-get update -y 
RUN apt-get upgrade -y 

WORKDIR /excalidraw-room

COPY package.json yarn.lock ./
RUN yarn

COPY . .
RUN yarn build

