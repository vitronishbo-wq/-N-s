import { MediaMetadata } from '../types';
import { compressImage } from '../utils/imageCompression';

export interface ProcessedMediaResult {
  dataUrl: string;
  thumbnailUrl: string;
  mimeType: string;
  sizeBytes: number;
  thumbnailSizeBytes: number;
  metadata: Partial<MediaMetadata>;
}

/**
 * 4.23 & 4.24: Client-side image compression with standard + thumbnail variant generation
 */
export async function processProfileMediaWithVariants(
  file: File,
  userId: string,
  variant: MediaMetadata['variant'] = 'avatar'
): Promise<ProcessedMediaResult> {
  // 1. Standard WebP (600px width, 0.75 quality)
  const standardDataUrl = await compressImage(file, 600, 0.75);

  // 2. Thumbnail WebP (150px width, 0.60 quality)
  const thumbnailDataUrl = await compressImage(file, 150, 0.60);

  const head = 'data:image/webp;base64,';
  const sizeBytes = Math.round(((standardDataUrl.length - head.length) * 3) / 4);
  const thumbnailSizeBytes = Math.round(((thumbnailDataUrl.length - head.length) * 3) / 4);

  const mediaId = `media_${userId}_${Date.now()}`;

  const metadata: Partial<MediaMetadata> = {
    id: mediaId,
    userId,
    url: standardDataUrl,
    thumbnailUrl: thumbnailDataUrl,
    mimeType: 'image/webp',
    sizeBytes,
    variant,
    createdAt: Date.now()
  };

  return {
    dataUrl: standardDataUrl,
    thumbnailUrl: thumbnailDataUrl,
    mimeType: 'image/webp',
    sizeBytes,
    thumbnailSizeBytes,
    metadata
  };
}

export async function processProfileMedia(file: File): Promise<{
  dataUrl: string;
  mimeType: string;
  sizeBytesEstimate: number;
}> {
  const res = await processProfileMediaWithVariants(file, 'guest');
  return {
    dataUrl: res.dataUrl,
    mimeType: res.mimeType,
    sizeBytesEstimate: res.sizeBytes
  };
}
