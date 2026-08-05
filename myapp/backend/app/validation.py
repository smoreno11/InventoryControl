"""Shared request validation helper.

The inventory routes report several problems at once as a single human-readable
sentence (``"Item Type is required. Serial Number is required."``) because the
frontend renders ``detail`` directly into the error banner. Pydantic's built-in
validation would return a list of error objects instead, so validation that the
user should see stays here.
"""

from fastapi import HTTPException


class FieldErrors:
    """Collects field problems, then raises them together as one 400."""

    def __init__(self) -> None:
        self._errors: list[str] = []

    def require(self, value: str, label: str) -> str:
        """Strip ``value`` and record an error if it is empty. Returns the stripped value."""
        cleaned = (value or "").strip()
        if not cleaned:
            self._errors.append(f"{label} is required.")
        return cleaned

    def add(self, message: str) -> None:
        self._errors.append(message)

    def raise_if_any(self) -> None:
        if self._errors:
            raise HTTPException(status_code=400, detail=" ".join(self._errors))
