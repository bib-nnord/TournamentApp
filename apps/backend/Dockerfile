# Use official Node.js image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and prisma schema, then install dependencies
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm install --production
RUN npx prisma generate

# Copy the rest of your backend code
COPY . .

# Expose port (match your app's port)
EXPOSE 2000

# Start the server
CMD ["npm", "start"]
