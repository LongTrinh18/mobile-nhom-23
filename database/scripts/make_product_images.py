"""Tạo ảnh sản phẩm cho bucket Supabase `product-images` từ ảnh danh mục có sẵn.

Đường dẫn khớp đúng bảng public.product_media (03_seed.sql): products/{mã SP}/{màu}/{1|2}.webp
  1.webp = ảnh chính, 2.webp = ảnh cận chi tiết.
Ảnh nguồn: frontend/assets/images/catalog/category-atlas-v1.png (lưới 4x4).
Màu không có sẵn trong ảnh gốc (áo thun Đen, áo khoác Xanh navy) được đổi màu riêng phần quần áo.

Chạy (cần Python 3 + Pillow):  python database/scripts/make_product_images.py
Kết quả: database/storage/product-images/products/...
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[2]
ATLAS = ROOT / 'frontend/assets/images/catalog/category-atlas-v1.png'
OUT = ROOT / 'database/storage/product-images'
SIZE = 640
BACKGROUND = (241, 238, 236)

# (mã SP, color_code, hàng, cột trong atlas, đổi màu (tối, giữa, sáng) hoặc None)
PRODUCTS = [
    ('AT001', 'black', 0, 0, ('#101013', '#34353b', '#8a8c93')),  # áo thun navy -> đen
    ('AT001', 'white', 1, 0, None),                              # áo thun trắng kem
    ('SM001', 'blue', 0, 1, None),                               # sơ mi Oxford xanh nhạt
    ('AK001', 'navy', 0, 3, ('#0a1124', '#1d2b52', '#7e8db6')),   # áo khoác be -> navy
    ('QJ001', 'blue', 0, 2, None),                               # quần jean
    ('QK001', 'beige', 1, 3, None),                              # quần kaki be
]


def cell(atlas: Image.Image, row: int, column: int) -> Image.Image:
    step = atlas.width / 4
    box = (round(column * step), round(row * step), round((column + 1) * step), round((row + 1) * step))
    return atlas.crop(box)


def garment_mask(image: Image.Image) -> Image.Image:
    diff = ImageChops.difference(image, Image.new('RGB', image.size, BACKGROUND)).convert('L')
    mask = diff.point(lambda v: 255 if v > 30 else 0)
    mask = mask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    return mask.filter(ImageFilter.GaussianBlur(1.0))


def recolor(image: Image.Image, palette: tuple[str, str, str]) -> Image.Image:
    mask = garment_mask(image)
    gray = ImageOps.grayscale(image)
    # Kéo giãn độ sáng chỉ trong vùng quần áo để giữ nếp vải, đường may.
    histogram = gray.histogram(mask.point(lambda v: 255 if v > 128 else 0))
    total = sum(histogram)
    low = next(i for i in range(256) if sum(histogram[:i + 1]) >= total * 0.02)
    high = next(i for i in range(255, -1, -1) if sum(histogram[i:]) >= total * 0.02)
    span = max(1, high - low)
    stretched = gray.point(lambda v: max(0, min(255, round((v - low) * 255 / span))))
    dark, mid, light = palette
    colored = ImageOps.colorize(stretched, black=dark, mid=mid, white=light)
    return Image.composite(colored, image, mask)


def detail(image: Image.Image) -> Image.Image:
    """Ảnh cận: phóng 1,6 lần vùng thân trên (cổ áo, cạp quần, chất vải)."""
    width, height = image.size
    side = round(width / 1.6)
    left = round((width - side) / 2)
    top = round(height * 0.12)
    return image.crop((left, top, left + side, top + side))


def save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image = image.resize((SIZE, SIZE), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
    image.save(path, 'WEBP', quality=86, method=6)


def main() -> None:
    atlas = Image.open(ATLAS).convert('RGB')
    for code, color, row, column, palette in PRODUCTS:
        base = cell(atlas, row, column)
        if palette:
            base = recolor(base, palette)
        folder = OUT / 'products' / code / color
        save(base, folder / '1.webp')
        save(detail(base), folder / '2.webp')
        print('ok', folder.relative_to(OUT).as_posix())


if __name__ == '__main__':
    main()
