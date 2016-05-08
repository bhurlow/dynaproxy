FROM node:6.0.0
RUN apt-get update
RUN apt-get install -y curl
RUN apt-get install -y vim 
ADD . /app
WORKDIR /app
CMD node index.js
