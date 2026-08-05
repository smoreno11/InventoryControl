"""File upload route.

The client controls ``file.filename`` entirely, so it is treated as hostile:
only the final path component is kept, the extension must be on the allow-list,
and the resolved destination is checked to be inside the upload directory before
anything is written.
"""

import unicodedata
from pathlib import Path, PurePosixPath, PureWindowsPath

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.config import ALLOWED_UPLOAD_SUFFIXES, MAX_UPLOAD_BYTES, UPLOAD_DIR

router = APIRouter(prefix="/api", tags=["upload"])


def safe_filename(raw: str | None) -> str:
    """Reduce a client-supplied filename to a single safe path component.

    Strips any directory part (POSIX or Windows), rejects names that are empty
    or made only of dots, and requires an allow-listed extension.
    """
    if not raw:
        raise HTTPException(status_code=400, detail="A filename is required.")

    # Normalise first so look-alike Unicode separators cannot smuggle a path in.
    normalised = unicodedata.normalize("NFKC", raw).replace("\x00", "")

    # Take the last component under both separator conventions — a Windows
    # client can send "..\\..\\app\\db.py", which PurePosixPath alone keeps whole.
    name = PureWindowsPath(PurePosixPath(normalised).name).name.strip()

    if not name or set(name) <= {"."}:
        raise HTTPException(status_code=400, detail="Invalid filename.")

    suffix = Path(name).suffix.lower()
    if suffix not in ALLOWED_UPLOAD_SUFFIXES:
        allowed = ", ".join(sorted(ALLOWED_UPLOAD_SUFFIXES))
        raise HTTPException(
            status_code=400,
            detail=f"File type '{suffix or 'unknown'}' is not allowed. Allowed types: {allowed}",
        )

    return name


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    name = safe_filename(file.filename)

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    destination = (UPLOAD_DIR / name).resolve()

    # Belt and braces: even after sanitising, refuse anything that escaped.
    if destination.parent != UPLOAD_DIR.resolve():
        raise HTTPException(status_code=400, detail="Invalid filename.")

    written = 0
    try:
        with destination.open("wb") as buffer:
            while chunk := await file.read(1024 * 1024):
                written += len(chunk)
                if written > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.",
                    )
                buffer.write(chunk)
    except HTTPException:
        destination.unlink(missing_ok=True)
        raise
    finally:
        await file.close()

    return {
        "filename": name,
        "size": written,
        "message": "File uploaded successfully",
    }
