FROM python:3.11-slim

WORKDIR /app

# Install deps first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

EXPOSE 8000

# Seed DB (idempotent) then start API server
CMD ["sh", "-c", "python -m api.seed && uvicorn api.main:app --host 0.0.0.0 --port 8000"]
