/** File upload endpoint. */

import { postForm } from "./client";

export interface UploadResult {
  filename: string;
  size: number;
  message: string;
}

/**
 * Upload a file to the backend.
 *
 * The path is relative on purpose. This previously pointed at
 * `http://127.0.0.1:8000/api/upload`, which bypassed Vite's dev proxy and
 * would have broken in any deployment that was not a developer's laptop.
 */
export function uploadFile(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  return postForm<UploadResult>("/api/upload", form);
}
