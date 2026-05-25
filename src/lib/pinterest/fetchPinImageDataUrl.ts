import sharp from 'sharp';

const SATORI_MIME = new Set(['image/jpeg', 'image/png', 'image/gif']);

/**
 * Satori (@vercel/og) no incrusta WebP en <img>. Descarga la foto y devuelve data URL PNG/JPEG.
 */
export async function fetchPinImageDataUrl(imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.error('[fetchPinImageDataUrl] HTTP', res.status, imageUrl);
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
    const isWebp =
      contentType === 'image/webp' || imageUrl.toLowerCase().includes('.webp');

    if (!isWebp && SATORI_MIME.has(contentType)) {
      return `data:${contentType};base64,${buffer.toString('base64')}`;
    }

    const png = await sharp(buffer).rotate().png({ quality: 90 }).toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch (err) {
    console.error('[fetchPinImageDataUrl] failed', imageUrl, err);
    return null;
  }
}
