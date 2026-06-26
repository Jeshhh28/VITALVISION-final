"""
Root Vercel serverless entry that exposes the FastAPI app from `backend`.
Vercel looks for `app` in this file.
"""
import os
import sys

# Add the backend directory to the path so imports resolve (project_root/backend)
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_path = os.path.join(root, "backend")
sys.path.insert(0, backend_path)

from app.main import app  # noqa: F401  — Vercel picks up `app` from here
