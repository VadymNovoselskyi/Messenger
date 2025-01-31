# Use official Node.js image as base
FROM node:latest

# Set working directory inside the container
WORKDIR /www/client

# Copy package.json and package-lock.json first
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all source code into container
COPY . .

# Run the frontend development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
