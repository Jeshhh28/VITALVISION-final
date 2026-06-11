#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ -d "../.venv" ]; then
  source ../.venv/bin/activate
elif [ -d ".venv" ]; then
  source .venv/bin/activate
else
  python3.11 -m venv .venv
  source .venv/bin/activate
fi
export PYTHONPATH=.

pip install -q -r requirements-db.txt
pip install -q fastapi uvicorn python-multipart opencv-python numpy scipy Pillow

alembic upgrade head
python scripts/seed_demo_user.py

exec uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
