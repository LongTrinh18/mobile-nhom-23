import { AtlasPicture } from './ProductPicture';

/** One locally bundled atlas keeps all category photographs available offline. */
export function CategoryPicture({ row, column }: { row: number; column: number }) {
  return <AtlasPicture row={row} column={column} style={{ width: '100%', aspectRatio: 1 }} />;
}
