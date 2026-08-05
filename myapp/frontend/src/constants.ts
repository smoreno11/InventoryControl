/** Values shared across pages that were previously hardcoded in several places. */

/**
 * Staff who can be selected in the workflow dropdowns.
 * Was duplicated in `getOptions()` and `buildAssessmentRow()`.
 */
export const TEAM_MEMBERS = ["John", "Saul", "Ryan", "Dan", "William", "Michael"] as const;

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** Workflow steps offered in the item assessment modal, in order. */
export const WORKFLOW_FIELDS = ["TESTEDBY", "PACKEDBY", "SHIPPEDBY", "RETURNEDBY"] as const;
