"""Central configuration.

Every filesystem path is resolved relative to this file rather than the current
working directory, so the app behaves the same whether it is started from
``backend/``, from the repo root, or by an editor's run button.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# backend/app/config.py -> backend/
BACKEND_DIR = Path(__file__).resolve().parent.parent

DB_PATH = BACKEND_DIR / "inventory.db"
UPLOAD_DIR = BACKEND_DIR / "uploads"

API_HOST = os.getenv("API_HOST", "127.0.0.1")
API_PORT = int(os.getenv("API_PORT", "8000"))

# Comma-separated origins; "*" (the dev default) allows any.
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))

# Spreadsheets for inventory import, images for damage reports.
ALLOWED_UPLOAD_SUFFIXES = {
    ".csv", ".tsv", ".xls", ".xlsx",
    ".png", ".jpg", ".jpeg", ".webp", ".heic",
}
