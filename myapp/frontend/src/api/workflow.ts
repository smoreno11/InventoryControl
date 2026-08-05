/** Workflow-field and shipping endpoints.

Both pages read and write the same `workflow_fields` table: the assessment modal
records who tested or packed a unit, and the shipping page attaches the outgoing
tracking number. */

import type { BoxResult, PackedBox, WorkflowFields } from "../types";
import { get, post } from "./client";

export const OUTGOING_TRACKING = "OUTGOING_TRACKING";
export const BOX_NUMBER = "BOX_NUMBER";

export const getWorkflowFields = (serialNumber: string) =>
  get<WorkflowFields>(`/api/workflow-fields?serial_number=${encodeURIComponent(serialNumber)}`);

export const setWorkflowField = (serialNumber: string, field: string, value: string) =>
  post<{ ok: boolean }>("/api/update-field", {
    serial_number: serialNumber,
    field,
    value,
  });

/** Look up a packed box by its 4-digit number. Throws ApiError 404 if unknown. */
export const lookupBox = (boxNumber: string) =>
  get<BoxResult>(`/api/box-lookup?box_number=${encodeURIComponent(boxNumber)}`);

export const listPackedBoxes = () => get<PackedBox[]>("/api/packed-boxes");
