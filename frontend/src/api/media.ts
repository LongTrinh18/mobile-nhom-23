/** Ảnh/video: database chỉ lưu đường dẫn → ghép thành link công khai. */
import { db } from './client';

export function mediaUrl(bucket: string | null, path: string | null): string | null {
  if (!bucket || !path) return null;
  return db().storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
export const imageUrl = (path: string | null) => mediaUrl('product-images', path);
