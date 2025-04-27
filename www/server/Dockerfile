# Use official Node.js image as base
FROM node:latest

# Set working directory inside the container
WORKDIR /usr/src/server

# Copy package.json and package-lock.json first (if available)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source code into container
COPY . .

# Run the application
CMD ["npm", "run", "dev"]
