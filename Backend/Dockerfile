# Dockerfile for HemoScan PHP REST API + Python 3 TFLite Inference Engine
FROM php:8.2-apache

# Install system dependencies, Python 3, pip, GD build deps, and utilities
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    libpng-dev \
    libjpeg-dev \
    libfreetype6-dev \
    zip \
    unzip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Configure & install PHP extensions
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) mysqli pdo pdo_mysql gd

# Enable Apache rewrite & headers modules
RUN a2enmod rewrite headers

# Install Python AI inference dependencies
RUN pip3 install --no-cache-dir ai-edge-litert numpy Pillow --break-system-packages || \
    pip3 install --no-cache-dir tflite-runtime numpy Pillow --break-system-packages

# Set working directory
WORKDIR /var/www/html

# Copy backend files into Apache document root
COPY . /var/www/html/

# Ensure upload directory permissions
RUN mkdir -p /var/www/html/uploads/scans /var/www/html/uploads/profiles \
    && chmod -R 777 /var/www/html/uploads

EXPOSE 80

CMD ["apache2-foreground"]
