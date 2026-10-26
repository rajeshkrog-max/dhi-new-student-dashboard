// The photo of a blog post (spec house/0014). A picture is shrunk and saved again in the browser before it is sent, which also drops where and with
// what it was taken. The server checks it again (size, the file's own first bytes, how fresh it is), so nothing here is trusted.
export const PHOTO_MAX_SIDE = 1280;
export const PHOTO_QUALITY = 0.85;
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";
const PHOTO_TYPE = /^image\/(jpeg|png|webp)$/;

// The size a picture is drawn at: the same shape, with its long side no longer than `max`, and never larger than it was.
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export const isPhotoType = (type: string): boolean => PHOTO_TYPE.test(type);

// Shrinks a picture file to a JPEG in the browser. Throws an Error with a short code when the browser cannot read it.
export async function shrinkPhoto(file: File): Promise<Blob> {
  if (!isPhotoType(file.type)) throw new Error("not_a_picture");
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, PHOTO_MAX_SIDE);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no_canvas");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", PHOTO_QUALITY));
  if (!blob) throw new Error("no_blob");
  return blob;
}
