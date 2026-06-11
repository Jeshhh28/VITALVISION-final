"""
Vercel serverless entrypoint for the VitalVision FastAPI backend.
Vercel's Python runtime looks for `app` in this file.
"""
import sys
import os

# Add the backend directory to the path so all imports resolve
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app  # noqa: F401  — Vercel picks up `app` from here
