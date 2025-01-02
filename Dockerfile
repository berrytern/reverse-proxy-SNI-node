FROM node:22-alpine
ENV PYTHONUNBUFFERED=1
RUN apk --no-cache add python3 bash curl grep tzdata g++ make

# Create app directory
RUN mkdir -p /usr/src/api-gtw
WORKDIR /usr/src/api-gtw
RUN mkdir -p /etc/ssl
# Install app dependencies
COPY package.json package-lock.json /usr/src/api-gtw/ 
RUN npm install

# Copy app source
COPY . /usr/src/api-gtw

EXPOSE 443
EXPOSE 80

CMD ["npm", "start"]
