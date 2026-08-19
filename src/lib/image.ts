/** Product images are compressed in the browser before they are sent up. */

export const MAX_WIDTH = 800;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export type CompressedImage = { blob: Blob; width: number; height: number };

/**
 * Scales an image down to `MAX_WIDTH` and re-encodes it as JPEG. An image
 * already narrower than the cap keeps its width — this never upscales.
 */
export async function compressImage(
  file: File,
  maxWidth: number = MAX_WIDTH,
): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file);

  try {
    const scale = Math.min(1, maxWidth / bitmap.width);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not read that image. Try another file.");

    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );

    if (!blob) throw new Error("Could not read that image. Try another file.");

    return { blob, width, height };
  } finally {
    bitmap.close();
  }
}
