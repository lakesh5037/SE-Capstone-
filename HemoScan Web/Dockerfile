# Step 1: Build the React application
FROM node:20-alpine AS build

WORKDIR /app

# Copy dependency definition files
COPY package*.json ./

# Install project dependencies
RUN npm ci

# Copy all frontend files to the container
COPY . .

# Build the production application
RUN npm run build

# Step 2: Serve the built React application using Nginx
FROM nginx:stable-alpine

# Copy the build output from Step 1 to Nginx document root
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx configuration (handles SPA routing + static assets like logo.png)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 for traffic
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
