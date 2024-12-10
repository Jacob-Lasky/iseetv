#!/bin/bash

# Initialize database
python init_db.py

# Start FastAPI
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload 