import type React from "react";

const MAX_DIM = 256;

/** 画像ファイルを最大256pxに縮小してdataURL化する（キャラのデフォルト立ち絵・表情画像・背景素材に使用） */
export function loadImageAsThumb(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("ファイルの読み込みに失敗しました"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("画像として読み込めませんでした"));
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          const scale = MAX_DIM / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("画像を処理できませんでした"));
        ctx.drawImage(img, 0, 0, width, height);
        const isJpeg = /jpe?g$/i.test(file.type) || /\.jpe?g$/i.test(file.name);
        resolve(isJpeg ? canvas.toDataURL("image/jpeg", 0.85) : canvas.toDataURL("image/png"));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/** 音声ファイルなど、リサイズせずそのままdataURL化する */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("ファイルの読み込みに失敗しました"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

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
