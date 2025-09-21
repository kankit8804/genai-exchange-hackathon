FROM python:3.11-slim

# (Optional) parsers like file type detection
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmagic1 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

# 👇 COPY files relative to the api/ folder (no "api/" prefix)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the app
COPY . ./

EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
