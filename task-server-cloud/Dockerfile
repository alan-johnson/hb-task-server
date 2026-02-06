FROM node:18-slim

# Create app directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Create data directory for file-based storage (development only)
RUN mkdir -p /app/data

# Expose port (configurable via PORT env var)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Start the cloud-ready server
CMD ["npm", "run", "start:cloud"]
