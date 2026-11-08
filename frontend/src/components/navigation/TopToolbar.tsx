import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useGlobalSearchParams, usePathname } from 'expo-router';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '../../context/CartContext';
import { theme } from '../../theme/theme';
import { useLogicalBack } from '../../navigation/useLogicalBack';

function SearchField({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  function search() {
    Keyboard.dismiss();
    router.navigate({ pathname: '/products', params: { q: query.trim() } });
  }
  return <View style={styles.search}>
    <Pressable accessibilityRole="button" accessibilityLabel="Tìm kiếm sản phẩm" onPress={search} style={styles.searchButton}>
      <Ionicons name="search-outline" size={21} color={theme.colors.ink} />
    </Pressable>
    <TextInput accessibilityLabel="Nhập từ khóa tìm kiếm" placeholder="Tìm kiếm sản phẩm" placeholderTextColor={theme.colors.muted}
      value={query} onChangeText={setQuery} onSubmitEditing={search} returnKeyType="search"
      autoCapitalize="none" autoCorrect={false} style={styles.input} />
    {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Xóa từ khóa tìm kiếm" hitSlop={6}
      onPress={() => { setQuery(''); router.navigate({ pathname: '/products', params: { q: '' } }); }} style={styles.clear}>
      <Ionicons name="close-circle" size={18} color={theme.colors.muted} />
    </Pressable>}
  </View>;
}
export function TopToolbar({ backDisabled = false }: { backDisabled?: boolean }) {
  const goBack = useLogicalBack(backDisabled);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { q } = useGlobalSearchParams<{ q?: string | string[] }>();
  const { count } = useCart();
  const query = Array.isArray(q) ? q[0] ?? '' : q ?? '';
  const isMainTab = ['/', '/orders', '/notifications', '/account'].includes(pathname);
  return <View style={[styles.container, { paddingTop: insets.top, paddingLeft: Math.max(12, insets.left), paddingRight: Math.max(12, insets.right) }]}>
    <View style={styles.row}>
      {!isMainTab && <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" style={styles.iconButton}
        disabled={backDisabled} onPress={goBack}>
        <Ionicons name="arrow-back" size={24} color={theme.colors.ink} />
      </Pressable>}
      <SearchField key={query} initialQuery={query} />
      <Pressable accessibilityRole="button" accessibilityLabel={'Giỏ hàng, ' + count + ' sản phẩm'}
        accessibilityState={{ selected: pathname === '/cart' }} style={styles.iconButton}
        onPress={() => { Keyboard.dismiss(); router.navigate('/cart'); }}>
        <Ionicons name={pathname === '/cart' ? 'bag-handle' : 'bag-handle-outline'} size={25} color={theme.colors.ink} />
        {count > 0 && <View pointerEvents="none" style={styles.badge}><Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text></View>}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Chatbot AI" accessibilityState={{ selected: pathname === '/chatbot' }}
        style={styles.iconButton} onPress={() => { Keyboard.dismiss(); router.navigate('/chatbot'); }}>
        <Ionicons name={pathname === '/chatbot' ? 'chatbubbles' : 'chatbubbles-outline'} size={25} color={theme.colors.ink} />
        <View pointerEvents="none" style={styles.aiTag}><Text style={styles.aiText}>AI</Text></View>
      </Pressable>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  container: { backgroundColor: theme.colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 10, minHeight: 64 },
  search: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.soft, borderRadius: 8, height: 44, marginRight: 4 },
  searchButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minWidth: 0, paddingVertical: 10, fontSize: 14, color: theme.colors.ink },
  clear: { width: 30, height: 44, justifyContent: 'center', alignItems: 'center' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  badge: { position: 'absolute', right: 0, top: 0, borderRadius: 10, minWidth: 18, height: 18, paddingHorizontal: 3, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  aiTag: { position: 'absolute', right: 0, bottom: 1, paddingHorizontal: 3, borderRadius: 4, backgroundColor: theme.colors.ink, borderWidth: 1, borderColor: '#fff' },
  aiText: { color: '#fff', fontSize: 8, fontWeight: '800', lineHeight: 12 },
});
