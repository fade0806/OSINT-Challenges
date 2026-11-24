const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const MAX_PANORAMA_BYTES = 48 * 1024 * 1024;

function drawJpeg(bitmap: ImageBitmap, maxWidth: number, quality: number) {
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.max(2, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that image.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  const url = canvas.toDataURL("image/jpeg", quality);
  const data = url.split(",")[1];
  if (!data) throw new Error("Could not encode that image.");
  return data;
}

export function readOriginal(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const data = result.split(",")[1];
      if (!data) reject(new Error("Could not read that image."));
      else resolve(data);
    };
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });
}

export async function inspectCapture(file: File) {
  if (!ACCEPT.includes(file.type) && !file.type.startsWith("image/")) {
    throw new Error("Use a JPEG, PNG, or WebP panorama.");
  }
  if (file.size > MAX_PANORAMA_BYTES) {
    throw new Error("That file is over 48 MB.");
  }
  const bitmap = await createImageBitmap(file);
  try {
    const ratio = bitmap.width / bitmap.height;
    const thumb = drawJpeg(bitmap, 960, 0.82);
    return {
      thumb,
      mime: file.type || "image/jpeg",
      width: bitmap.width,
      height: bitmap.height,
      bytes: file.size,
      wide: ratio > 1.7 && ratio < 2.3,
    };
  } finally {
    bitmap.close();
  }
}
