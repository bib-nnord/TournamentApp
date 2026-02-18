# Use official Node.js image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of your backend code
COPY . .

# Expose port (match your app's port)
EXPOSE 2000

# Start the server
CMD ["node", "server.js"]
