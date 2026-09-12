import type React from "react";

export function hasFileDrag(e: DragEvent | React.DragEvent): boolean {
  return Array.from(e.dataTransfer?.types || []).includes("Files");
}

export function firstImageFile(e: DragEvent | React.DragEvent): File | null {
  const files = e.dataTransfer?.files;
  if (!files) return null;
  for (const f of Array.from(files)) if (f.type.startsWith("image/")) return f;
  return null;
}

export function firstFile(e: DragEvent | React.DragEvent): File | null {
  const files = e.dataTransfer?.files;
  return files && files.length ? files[0] : null;
}
