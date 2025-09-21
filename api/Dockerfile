FROM python:3.11-slim

# Small system lib that helps with file-type detection (optional but handy)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmagic1 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

# Install Python deps first (cache-friendly)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the app code (everything under api/)
COPY . /app/

# Cloud Run will provide $PORT; default to 8080
ENV PORT=8080
EXPOSE 8080

# Start FastAPI with uvicorn
CMD ["uvicorn","main:app","--host","0.0.0.0","--port","8080"]
