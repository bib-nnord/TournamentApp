# Use official Node.js image
FROM node:20-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy workspace root + backend package files for pnpm install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/backend/prisma ./apps/backend/prisma
COPY apps/backend/prisma.config.ts ./apps/backend/
RUN pnpm --filter backend install --frozen-lockfile
RUN pnpm --filter backend exec prisma generate

# Copy the rest of your backend code and set working dir
COPY apps/backend/ ./apps/backend/
WORKDIR /app/apps/backend

# Expose port (match your app's port)
EXPOSE 2000

# Start the server
CMD ["pnpm", "run", "start"]
