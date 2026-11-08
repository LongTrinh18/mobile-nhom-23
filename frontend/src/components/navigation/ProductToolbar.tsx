import { useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useGlobalSearchParams } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '../../context/CartContext';
import { useLogicalBack } from '../../navigation/useLogicalBack';
import { routeContext } from '../../navigation/routes';
import { shareProduct } from '../../services/product-share';
import { theme } from '../../theme/theme';
import type { Product } from '../../types/shop';

export function ProductToolbar({ product }: { product?: Product }) {
  const insets = useSafeAreaInsets();
  const goBack = useLogicalBack();
  const params = useGlobalSearchParams();
  const { count } = useCart();
  const busy = useRef(false);
  const [sharing, setSharing] = useState(false);
  async function share() {
    if (!product || busy.current) return;
    busy.current = true; setSharing(true);
    try { if (await shareProduct(product) === 'copied') Alert.alert('Đã sao chép liên kết', 'Bạn có thể dán liên kết sản phẩm để chia sẻ.'); }
    catch (error) { Alert.alert('Chưa chia sẻ được', error instanceof Error ? error.message : 'Vui lòng thử lại.'); }
    finally { busy.current = false; setSharing(false); }
  }
  return <View style={[styles.container, { paddingTop: insets.top, paddingLeft: Math.max(12, insets.left), paddingRight: Math.max(12, insets.right) }]}>
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={goBack} style={styles.button}>
        <Ionicons name="arrow-back" size={25} color={theme.colors.ink} />
      </Pressable>
      <View style={styles.spacer} />
      <Pressable accessibilityRole="button" accessibilityLabel="Chia sẻ sản phẩm" accessibilityState={{ disabled: !product || sharing }}
        disabled={!product || sharing} onPress={share} style={[styles.button, (!product || sharing) && styles.disabled]}>
        <Ionicons name="share-social-outline" size={24} color={theme.colors.ink} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={'Giỏ hàng, ' + count + ' sản phẩm'} onPress={() => router.navigate('/cart')} style={styles.button}>
        <Ionicons name="bag-handle-outline" size={25} color={theme.colors.ink} />
        {count > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text></View>}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Chatbot AI" style={styles.button}
        onPress={() => router.push({ pathname: '/chatbot', params: { ...routeContext(params), productId: product?.id ?? '' } })}>
        <Ionicons name="chatbubbles-outline" size={25} color={theme.colors.ink} />
      </Pressable>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  container: { backgroundColor: theme.colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 64, paddingVertical: 10 },
  spacer: { flex: 1 }, button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  disabled: { opacity: 0.4 },
  badge: { position: 'absolute', right: 0, top: 0, minWidth: 18, height: 18, paddingHorizontal: 3, borderRadius: 9, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
