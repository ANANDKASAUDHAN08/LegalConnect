FROM node:20-alpine
WORKDIR /app

# Copy package configuration files
COPY package*.json ./
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Compile TypeScript
RUN npm run build

# Cloud Run binds to the PORT environment variable (default 8080)
EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

CMD ["npm", "start"]
