"""Workflow-field routes: who tested, packed, shipped, or returned a unit."""

from fastapi import APIRouter, HTTPException

from app.db import workflow as workflow_db
from app.schemas.workflow import WorkflowFieldUpdate

router = APIRouter(prefix="/api", tags=["workflow"])


@router.get("/workflow-fields")
def get_workflow_fields(serial_number: str):
    if not serial_number.strip():
        raise HTTPException(status_code=400, detail="serial_number is required")
    return workflow_db.get_fields(serial_number.strip())


@router.post("/update-field")
def update_field(payload: WorkflowFieldUpdate):
    if not payload.serial_number.strip():
        raise HTTPException(status_code=400, detail="serial_number is required")
    if not payload.field.strip():
        raise HTTPException(status_code=400, detail="field is required")

    workflow_db.set_field(
        payload.serial_number.strip(),
        payload.field.strip(),
        payload.value.strip(),
    )
    return {"ok": True}
