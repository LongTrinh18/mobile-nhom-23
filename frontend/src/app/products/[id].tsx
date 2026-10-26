import { useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/shop/Button';
import { CatalogStatus } from '../../components/shop/CatalogStatus';
import { useCart } from '../../context/CartContext';
import { useCatalog } from '../../features/catalog/useCatalog';
import { getStock } from '../../services/catalog-service';
import { theme } from '../../theme/theme';
import { cartItemKey, formatVnd } from '../../types/shop';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, retry } = useCatalog();
  const { addItem, items } = useCart();
  const product = data?.products.find(p => p.id === id);
  const [skuId, setSkuId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState('');

  useEffect(() => { setSkuId(product?.variants[0]?.id ?? ''); setQuantity(1); }, [product?.id]);
  useEffect(() => { setBranchId(data?.branches[0]?.id ?? ''); }, [data?.branches[0]?.id]);

  const variant = product?.variants.find(v => v.id === skuId);
  const selectedSize = variant?.size ?? '';
  const selectedColor = variant?.color ?? '';
  const sizes = useMemo(() => [...new Set(product?.variants.map(v => v.size) ?? [])], [product]);
  const colors = useMemo(() => [...new Set(product?.variants.filter(v => v.size === selectedSize).map(v => v.color) ?? [])], [product, selectedSize]);
  const branch = data?.branches.find(b => b.id === branchId);
  const stock = data && variant && branch ? getStock(data, variant.id, branch.id) : 0;
  const alreadyInCart = items.find(item => item.key === cartItemKey(variant?.id ?? '', branchId))?.quantity ?? 0;
  const remaining = Math.max(0, stock - alreadyInCart);

  useEffect(() => { setQuantity(1); setNotice(''); }, [skuId, branchId]);

  function chooseSize(size: string) {
    const next = product?.variants.find(v => v.size === size && v.color === selectedColor)
      ?? product?.variants.find(v => v.size === size);
    if (next) setSkuId(next.id);
  }
  function chooseColor(color: string) {
    const next = product?.variants.find(v => v.size === selectedSize && v.color === color);
    if (next) setSkuId(next.id);
  }
  function handleAdd() {
    if (!product || !variant || !branch || quantity > remaining || remaining <= 0) return;
    addItem({
      productId: product.id, productName: product.name,
      skuId: variant.id, skuCode: variant.sku,
      size: variant.size, color: variant.color,
      branchId: branch.id, branchName: branch.name,
      unitPriceVnd: product.priceVnd, imageUrl: product.imageUrl,
      maxAvailable: stock,
    }, quantity);
    setQuantity(1);
    setNotice('Đã thêm đúng SKU và chi nhánh vào giỏ hàng.');
    Alert.alert('Thêm giỏ thành công', `${product.name} · ${variant.size}/${variant.color}`, [
      { text: 'Tiếp tục mua' }, { text: 'Xem giỏ hàng', onPress: () => router.push('/cart') },
    ]);
  }

  if (loading || error || !data) return <CatalogStatus loading={loading} error={error} retry={retry} />;
  if (!product) return <CatalogStatus loading={false} error={null} empty retry={retry} />;

  return <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
    <View style={styles.picture}>
      {product.imageUrl ? <Image source={{ uri: product.imageUrl }} resizeMode="cover" style={{ width: '100%', height: '100%' }} /> :
        <View style={styles.imageMock}><Text style={styles.emoji}>👕</Text><Text style={styles.imageCaption}>Ảnh demo · Sản phẩm</Text></View>}
    </View>
    <Text style={styles.category}>{product.category.toUpperCase()}</Text>
    <Text style={styles.name}>{product.name}</Text>
    <Text style={styles.price}>{formatVnd(product.priceVnd)}</Text>
    <Text style={styles.description}>{product.description}</Text>

    <Text style={styles.label}>Kích thước</Text>
    <View style={styles.choices}>
      {sizes.map(size => <Pressable key={size} onPress={() => chooseSize(size)} style={[styles.choice, selectedSize === size && styles.selected]}>
        <Text style={[styles.choiceText, selectedSize === size && styles.selectedText]}>{size}</Text>
      </Pressable>)}
    </View>
    <Text style={styles.label}>Màu sắc</Text>
    <View style={styles.choices}>
      {colors.map(color => <Pressable key={color} onPress={() => chooseColor(color)} style={[styles.choice, selectedColor === color && styles.selected]}>
        <Text style={[styles.choiceText, selectedColor === color && styles.selectedText]}>{color}</Text>
      </Pressable>)}
    </View>
    <Text style={styles.label}>Chi nhánh nhận hàng</Text>
    <View style={styles.choices}>
      {data.branches.map(b => <Pressable key={b.id} onPress={() => setBranchId(b.id)} style={[styles.choice, branchId === b.id && styles.selected]}>
        <Text style={[styles.choiceText, branchId === b.id && styles.selectedText]}>{b.name}</Text>
      </Pressable>)}
    </View>
    <Text style={[styles.stock, stock === 0 && styles.outStock]}>Tồn kho: {stock} · Còn có thể thêm: {remaining}</Text>
    <Text style={styles.meta}>SKU: {variant?.sku ?? 'Không có biến thể'}</Text>
    <View style={styles.quantityRow}>
      <Text style={styles.label}>Số lượng</Text>
      <View style={styles.counter}>
        <Pressable onPress={() => setQuantity(q => Math.max(1, q - 1))} style={styles.counterButton}><Text style={styles.counterText}>−</Text></Pressable>
        <Text style={styles.quantity}>{Math.min(quantity, Math.max(1, remaining))}</Text>
        <Pressable onPress={() => setQuantity(q => Math.min(Math.max(1, remaining), q + 1))} style={styles.counterButton}><Text style={styles.counterText}>+</Text></Pressable>
      </View>
    </View>
    <Button title={remaining <= 0 ? 'Đã hết hàng / không còn lượt thêm' : 'Thêm vào giỏ hàng'} disabled={!variant || !branch || remaining <= 0} onPress={handleAdd}/>
    {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    {data.source === 'mock' ? <Text style={styles.demo}>Đang sử dụng dữ liệu mẫu. Đơn hàng chỉ ở chế độ demo.</Text> : null}
    <Button title="Xem giỏ hàng" variant="outline" onPress={() => router.push('/cart')} style={{ marginTop: 10 }}/>
  </ScrollView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: 18, paddingBottom: 45 },
  picture: { height: 290, backgroundColor: '#EEECE8', borderRadius: 16, overflow: 'hidden' },
  imageMock: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 72 },
  imageCaption: { color: theme.colors.muted, marginTop: 12 },
  category: { fontSize: 11, color: theme.colors.muted, marginTop: 18, letterSpacing: 1.2 },
  name: { fontWeight: '800', fontSize: 24, color: theme.colors.ink, marginTop: 6 },
  price: { color: theme.colors.primary, fontWeight: '800', fontSize: 23, marginTop: 6 },
  description: { fontSize: 14, color: theme.colors.muted, lineHeight: 22, marginTop: 12, marginBottom: 14 },
  label: { fontWeight: '700', color: theme.colors.ink, fontSize: 14, marginTop: 17, marginBottom: 10 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { borderColor: theme.colors.border, borderWidth: 1, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 12 },
  selected: { borderColor: theme.colors.ink, backgroundColor: theme.colors.ink },
  choiceText: { fontSize: 12, color: theme.colors.ink, fontWeight: '600' },
  selectedText: { color: '#fff' },
  stock: { color: theme.colors.success, fontSize: 12, fontWeight: '700', marginTop: 16 },
  outStock: { color: theme.colors.danger },
  meta: { color: theme.colors.muted, fontSize: 11, marginTop: 4 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 16 },
  counter: { flexDirection: 'row', alignItems: 'center', borderColor: theme.colors.border, borderWidth: 1, borderRadius: 10, backgroundColor: '#fff' },
  counterButton: { width: 39, height: 40, justifyContent: 'center', alignItems: 'center' },
  counterText: { fontSize: 22, color: theme.colors.ink },
  quantity: { minWidth: 29, textAlign: 'center', fontWeight: '700', color: theme.colors.ink },
  notice: { marginTop: 8, color: theme.colors.success, fontSize: 12 },
  demo: { marginTop: 12, color: '#765115', backgroundColor: '#FFF3D8', padding: 10, borderRadius: 8, fontSize: 12 },
});
