/** Spreadsheet upload button.

Two things were wrong with the original `createUploadUI`:

1. It ran at module top level, before `DOMContentLoaded` had built the page, so
   it always found a null button, logged "Button not found", and returned. The
   feature had never actually run.
2. It attached to `#month-all` — the "All Time" month filter — so un-breaking it
   as written would have made that button both filter the table and open a file
   picker. It gets its own control instead.

Note this only *stores* the file on the server. Nothing ingests it into the
INVENTORY table yet; that is `python -m app.scripts.import_csv` on the backend. */

import { ApiError } from "../api/client";
import { uploadFile } from "../api/upload";

const ACCEPT = ".csv,.tsv,.xls,.xlsx";

/** Wire the upload button. Call this after the page markup exists. */
export function mountUploadButton(): void {
  const button = document.getElementById("upload-file") as HTMLButtonElement | null;
  const msgEl = document.getElementById("upload-msg");
  if (!button || !msgEl) return;

  const setMessage = (text: string, kind: "ok" | "error" | "" = "") => {
    msgEl.className = `upload-msg${kind ? ` upload-msg-${kind}` : ""}`;
    msgEl.textContent = text;
  };

  button.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ACCEPT;

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      button.disabled = true;
      setMessage(`Uploading ${file.name}…`);

      try {
        const result = await uploadFile(file);
        setMessage(`Uploaded ${result.filename}.`, "ok");
        setTimeout(() => setMessage(""), 4000);
      } catch (err) {
        const detail =
          err instanceof ApiError ? err.message : "Upload failed — is the backend running?";
        setMessage(detail, "error");
      } finally {
        button.disabled = false;
      }
    };

    input.click();
  });
}
