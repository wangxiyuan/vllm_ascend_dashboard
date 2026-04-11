#!/bin/bash
set -e

echo "Starting vLLM Ascend Dashboard backend..."

# Fix permissions on mounted volumes
chown -R appuser:appuser /app/data /app/logs
chmod -R 755 /app/data /app/logs

echo "Permissions fixed, starting application..."

# Run uvicorn as appuser (not login shell, so we stay in /app)
exec su appuser -c "cd /app && PYTHONPATH=/app /opt/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000"
