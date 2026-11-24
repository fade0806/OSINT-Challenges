const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function drawJpeg(bitmap: ImageBitmap, maxWidth: number, quality: number) {
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.max(2, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that image.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  const url = canvas.toDataURL("image/jpeg", quality);
  const data = url.split(",")[1];
  if (!data) throw new Error("Could not encode that image.");
  return data;
}

export async function prepareCapture(file: File) {
  if (!ACCEPT.includes(file.type)) {
    throw new Error("Use a JPEG, PNG, or WebP panorama.");
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("That file is over 20 MB.");
  }
  const bitmap = await createImageBitmap(file);
  try {
    const ratio = bitmap.width / bitmap.height;
    const image = drawJpeg(bitmap, 4096, 0.82);
    const thumb = drawJpeg(bitmap, 960, 0.72);
    return {
      image,
      thumb,
      wide: ratio > 1.7 && ratio < 2.3,
    };
  } finally {
    bitmap.close();
  }
}
