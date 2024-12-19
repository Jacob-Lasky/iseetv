# Use node as the base image since it's lighter than python
FROM node:20-slim

# Install Python, FFmpeg, and Supervisor
RUN apt-get update && apt-get install -y \
    python3 \
    python3-poetry \
    ffmpeg \
    supervisor \
    nginx \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set up backend
WORKDIR /app/backend
COPY backend/pyproject.toml backend/poetry.lock ./
RUN poetry config virtualenvs.create false \
    && poetry install --no-root --no-dev

# Set up frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install

# Build the TypeScript React app
COPY frontend/ .
RUN npm run build

# Copy Supervisor configuration
COPY supervisord.conf /etc/supervisor/supervisord.conf

# Add nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Serve React frontend build
RUN mkdir -p /usr/share/nginx/html && \
    cp -r /app/frontend/build/* /usr/share/nginx/html/

# Copy application code
COPY backend /app/backend
COPY frontend /app/frontend

# Create data directory
RUN mkdir -p /data && chmod 777 /data

WORKDIR /app

EXPOSE 80

# Start Supervisor
CMD ["supervisord", "-c", "/etc/supervisor/supervisord.conf"]
