/** Shared modal slot for the returns page.

Both the new-return wizard and the detail/edit modal render into the same
container, so opening one implicitly replaces the other. */

import { q } from "../../lib/dom";
import { state } from "./state";

export function modalRoot(): HTMLDivElement {
  return q<HTMLDivElement>("#rtn-modal-root", state.container!);
}

/** Clear the modal and reset the state that belongs to it. */
export function closeModal(): void {
  state.wizardReturnId = null;
  state.detailReturn = null;
  modalRoot().innerHTML = "";
}
