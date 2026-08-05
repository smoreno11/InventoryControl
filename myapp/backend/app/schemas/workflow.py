"""Request bodies for the workflow-field routes."""

from pydantic import BaseModel


class WorkflowFieldUpdate(BaseModel):
    """One field value saved against a serial number."""

    serial_number: str
    field: str
    value: str
