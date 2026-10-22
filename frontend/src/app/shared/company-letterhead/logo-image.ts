const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_EDGE = 400; // a letterhead logo prints ~3.5 cm tall; 400 px keeps it sharp and the stored size small

export type LogoResult = { url: string } | { error: string };

/** Validates a picked file and returns it downscaled as a data URL (PNG keeps transparency, JPEG stays JPEG). */
export async function readLogo(file: File): Promise<LogoResult> {
  if (!ACCEPTED.includes(file.type)) return { error: 'Chỉ nhận ảnh PNG, JPG hoặc WebP.' };
  if (file.size > MAX_BYTES) return { error: 'Ảnh lớn hơn 2 MB — chọn ảnh nhỏ hơn.' };
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const jpeg = file.type === 'image/jpeg';
    if (jpeg) {
      ctx.fillStyle = '#fff'; // JPEG has no alpha — keep the paper white
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return { url: jpeg ? canvas.toDataURL('image/jpeg', 0.9) : canvas.toDataURL('image/png') };
  } catch {
    return { error: 'Không đọc được ảnh này — thử file khác.' };
  }
}
