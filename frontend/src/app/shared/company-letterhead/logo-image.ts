const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_EDGE = 400; // a letterhead logo prints ~3.5 cm tall; 400 px keeps it sharp and the stored size small

export type LogoResult = { url: string } | { error: string };

/**
 * The logo with its empty margin cut off (transparent pixels, or pixels the colour of the top-left corner), so a
 * small mark like the sidebar's shows the drawing itself, not a square of white. Keeps a 4 % breathing edge.
 * Returns the original URL when the image cannot be read or has no margin worth cutting.
 */
export async function trimLogo(src: string): Promise<string> {
  try {
    // createImageBitmap, not Image.decode(): decode() never settles in a background tab.
    const img = await createImageBitmap(await (await fetch(src)).blob());
    const { width: w, height: h } = img;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    img.close();
    const d = ctx.getImageData(0, 0, w, h).data;
    const [r0, g0, b0] = [d[0], d[1], d[2]];
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const k = (y * w + x) * 4;
        const ink = d[k + 3] > 16 && Math.abs(d[k] - r0) + Math.abs(d[k + 1] - g0) + Math.abs(d[k + 2] - b0) > 40;
        if (!ink) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) return src;
    const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.04);
    const x0 = Math.max(0, minX - pad), y0 = Math.max(0, minY - pad);
    const cw = Math.min(w, maxX + pad + 1) - x0, ch = Math.min(h, maxY + pad + 1) - y0;
    if (cw > w * 0.9 && ch > h * 0.9) return src;
    const out = document.createElement('canvas');
    out.width = cw;
    out.height = ch;
    out.getContext('2d')!.drawImage(canvas, x0, y0, cw, ch, 0, 0, cw, ch);
    return out.toDataURL('image/png');
  } catch {
    return src;
  }
}

/**
 * A square browser-tab icon from a logo: the drawing centred on a light rounded tile (`tile`, a CSS colour), so a
 * wide logo is not squeezed and a dark one still shows on a dark tab strip. Null when the image cannot be read.
 */
export async function squareIcon(src: string, tile: string, size = 64): Promise<string | null> {
  try {
    const img = await createImageBitmap(await (await fetch(src)).blob());
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = tile || 'white';
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, size * 0.2);
    ctx.fill();
    const pad = size * 0.08;
    const scale = Math.min((size - 2 * pad) / img.width, (size - 2 * pad) / img.height);
    const w = img.width * scale, h = img.height * scale;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    img.close();
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

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
