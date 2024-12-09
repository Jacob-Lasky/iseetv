FROM python:3.11-slim

WORKDIR /app

# Install Poetry
RUN pip install poetry

# Copy only requirements files first
COPY pyproject.toml poetry.lock ./

# Copy app directory
COPY app/ app/

# Install dependencies
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi

# Copy remaining files
COPY . .

# Initialize database
RUN poetry run python init_db.py

# Run FastAPI
CMD ["poetry", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"] 