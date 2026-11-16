import { useEffect, useRef, useState, type ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '../../components/ui/Text';
import { Price } from '../../components/ui/Price';
import { HomeProductSections } from '../../components/shop/HomeProductSections';
import { AtlasPicture, ProductPicture } from '../../components/shop/ProductPicture';
import { useCatalog } from '../../features/catalog/useCatalog';
import { useHomeMerchandising } from '../../features/catalog/useHomeMerchandising';
import { useRecentView } from '../../context/RecentViewContext';
import { customerGroups, type CustomerGroup } from '../../data/customer-groups';
import { theme } from '../../theme/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
const heroCopy: Record<CustomerGroup['key'], { title: string; column: number }> = {
  men: { title: 'Lifewear Nam', column: 1 },
  women: { title: 'Lifewear Nữ', column: 1 },
  kids: { title: 'Đồ Trẻ em', column: 1 },
  baby: { title: 'Đồ Em bé', column: 2 },
};
const perks: { icon: IconName; text: string }[] = [
  { icon: 'storefront-outline', text: 'Giữ hàng 3 ngày' },
  { icon: 'cash-outline', text: 'Trả khi nhận' },
  { icon: 'bicycle-outline', text: 'Freeship >500K' },
];

function GroupPage({ group, catalog, merchandising, showRecent }: {
  group: CustomerGroup; catalog: ReturnType<typeof useCatalog>; merchandising: ReturnType<typeof useHomeMerchandising>; showRecent: boolean;
}) {
  const { recentItems, clearRecentItems } = useRecentView();
  const hero = heroCopy[group.key];
  const browse = (section = '') => router.push({ pathname: '/products', params: { audience: group.key, section } });
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={hero.title + ', giảm 10% với mã UNIQLO10'} onPress={() => browse()} style={styles.banner}>
      <View style={[styles.bubble, styles.bubbleLarge]} />
      <View style={[styles.bubble, styles.bubbleSmall]} />
      <View style={styles.bannerText}>
        <Text style={styles.bannerEyebrow}>{hero.title.toLocaleUpperCase('vi')}</Text>
        <Text style={styles.bannerTitle}>Giảm 10%{'\n'}mọi đơn hàng</Text>
        <View style={styles.codeChip}><Text style={styles.codeText}>Nhập mã UNIQLO10</Text></View>
      </View>
      <View style={styles.bannerPictureBox}><AtlasPicture row={group.imageRow} column={hero.column} style={styles.bannerPicture} /></View>
    </Pressable>

    <View style={styles.perks}>
      {perks.map(perk => <View key={perk.text} style={styles.perk}>
        <Ionicons name={perk.icon} size={14} color={theme.colors.success} />
        <Text style={styles.perkText}>{perk.text}</Text>
      </View>)}
    </View>

    <View style={styles.panel}>
      <View style={styles.categoryGrid}>
        {group.categories.map(category => <Pressable key={category.key} accessibilityRole="button" accessibilityLabel={group.label + ' · ' + category.label}
          onPress={() => browse(category.key)} style={({ pressed }) => [styles.categoryItem, pressed && styles.pressed]}>
          <AtlasPicture row={group.imageRow} column={category.imageColumn} style={styles.categoryIcon} />
          <Text style={styles.categoryLabel} numberOfLines={1}>{category.label}</Text>
        </Pressable>)}
        <Pressable accessibilityRole="button" accessibilityLabel={'Tất cả sản phẩm ' + group.label} onPress={() => browse()}
          style={({ pressed }) => [styles.categoryItem, pressed && styles.pressed]}>
          <View style={[styles.categoryIcon, styles.categoryAll]}><Ionicons name="apps" size={22} color={theme.colors.primary} /></View>
          <Text style={styles.categoryLabel}>Tất cả</Text>
        </Pressable>
      </View>
    </View>

    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Mã giảm giá</Text>
      <View style={styles.vouchers}>
        <View style={styles.voucher}>
          <View style={styles.voucherValue}><Text style={styles.voucherBig}>10%</Text><Text style={styles.voucherSmall}>GIẢM</Text></View>
          <View style={styles.voucherDivider} />
          <View style={styles.voucherInfo}><Text style={styles.voucherCode}>UNIQLO10</Text><Text style={styles.voucherNote}>Mọi đơn hàng</Text></View>
        </View>
        <View style={styles.voucher}>
          <View style={styles.voucherValue}><Ionicons name="bicycle" size={20} color={theme.colors.primary} /><Text style={styles.voucherSmall}>FREESHIP</Text></View>
          <View style={styles.voucherDivider} />
          <View style={styles.voucherInfo}><Text style={styles.voucherCode}>FREESHIP</Text><Text style={styles.voucherNote}>Giao tận nơi</Text></View>
        </View>
      </View>
    </View>

    {showRecent && recentItems.length > 0 && <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text accessibilityRole="header" style={styles.panelTitle}>Vừa xem</Text>
        <Pressable accessibilityRole="button" onPress={clearRecentItems} hitSlop={10}><Text style={styles.clear}>Xóa</Text></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRow}>
        {recentItems.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'Xem lại ' + item.name}
          style={styles.recentCard} onPress={() => router.push({ pathname: '/products/[id]', params: { id: item.id, origin: 'home' } })}>
          <ProductPicture product={item} style={styles.recentPicture} />
          <Price value={item.priceVnd} size={13} />
        </Pressable>)}
      </ScrollView>
    </View>}

    <HomeProductSections audience={group.key} catalog={catalog} merchandising={merchandising} />
  </>;
}

export default function HomeScreen() {
  const catalog = useCatalog();
  const merchandising = useHomeMerchandising();
  const window = useWindowDimensions();
  const [pageWidth, setPageWidth] = useState(window.width);
  const [activeIndex, setActiveIndex] = useState(0);
  const pager = useRef<ScrollView>(null);
  useEffect(() => {
    pager.current?.scrollTo({ x: activeIndex * pageWidth, animated: false });
  }, [pageWidth, activeIndex]);

  return <View style={styles.screen} onLayout={event => setPageWidth(event.nativeEvent.layout.width)}>
    <View accessibilityRole="tablist" style={styles.groupTabs}>
      {customerGroups.map((group, index) => <Pressable key={group.key} accessibilityRole="tab"
        accessibilityLabel={group.label} accessibilityState={{ selected: activeIndex === index }}
        onPress={() => { setActiveIndex(index); pager.current?.scrollTo({ x: index * pageWidth, animated: false }); }}
        style={styles.groupTab}>
        <Text style={[styles.groupLabel, activeIndex === index && styles.activeLabel]}>{group.label}</Text>
        <View style={[styles.indicator, activeIndex === index && styles.indicatorActive]} />
      </Pressable>)}
    </View>
    <ScrollView ref={pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false} directionalLockEnabled
      style={styles.pager} onMomentumScrollEnd={event => {
        const index = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
        setActiveIndex(Math.max(0, Math.min(customerGroups.length - 1, index)));
      }}>
      {customerGroups.map((group, index) => <ScrollView key={group.key} style={{ width: pageWidth }}
        contentContainerStyle={styles.pageContent} nestedScrollEnabled showsVerticalScrollIndicator={false}
        accessibilityElementsHidden={activeIndex !== index} importantForAccessibility={activeIndex === index ? 'auto' : 'no-hide-descendants'}>
        <GroupPage group={group} catalog={catalog} merchandising={merchandising} showRecent={index === activeIndex} />
      </ScrollView>)}
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  pager: { flex: 1 },
  groupTabs: { flexDirection: 'row', backgroundColor: theme.colors.surface },
  groupTab: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'flex-end', gap: 7 },
  groupLabel: { fontSize: 15, color: theme.colors.muted },
  activeLabel: { color: theme.colors.ink, fontWeight: '700' },
  indicator: { height: 3, width: 22, borderRadius: 2, backgroundColor: 'transparent' },
  indicatorActive: { backgroundColor: theme.colors.primary },
  pageContent: { padding: 8, paddingBottom: 24, gap: 8 },
  pressed: { opacity: 0.7 },

  banner: { height: 148, borderRadius: theme.radius.lg, backgroundColor: theme.colors.primary, flexDirection: 'row', alignItems: 'center',
    overflow: 'hidden', paddingLeft: 16 },
  bubble: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  bubbleLarge: { width: 220, height: 220, right: -50, top: -70 },
  bubbleSmall: { width: 90, height: 90, left: -30, bottom: -40 },
  bannerText: { flex: 1, gap: 6 },
  bannerEyebrow: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600', letterSpacing: 1 },
  bannerTitle: { color: '#fff', fontSize: 22, lineHeight: 28, fontWeight: '700' },
  codeChip: { alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: theme.radius.pill, paddingHorizontal: 10, paddingVertical: 4, marginTop: 2 },
  codeText: { color: theme.colors.primary, fontSize: 12, fontWeight: '700' },
  bannerPictureBox: { width: 116, height: 116, borderRadius: theme.radius.lg, overflow: 'hidden', marginRight: 16, backgroundColor: '#fff' },
  bannerPicture: { width: '100%', height: '100%' },

  perks: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: theme.colors.surface, borderRadius: theme.radius.md,
    paddingHorizontal: 10, paddingVertical: 8 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  perkText: { fontSize: 11, color: theme.colors.text, fontWeight: '500' },

  panel: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 12, gap: 10 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  panelTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.ink },
  clear: { fontSize: 12, color: theme.colors.muted },

  categoryGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  categoryItem: { width: '19%', alignItems: 'center', gap: 6 },
  categoryIcon: { width: 54, height: 54, borderRadius: 27 },
  categoryAll: { backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  categoryLabel: { fontSize: 11, color: theme.colors.text, textAlign: 'center' },

  vouchers: { flexDirection: 'row', gap: 8 },
  voucher: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.primarySoft, borderRadius: theme.radius.md, paddingVertical: 8 },
  voucherValue: { width: 62, alignItems: 'center' },
  voucherBig: { fontSize: 20, lineHeight: 24, fontWeight: '700', color: theme.colors.primary },
  voucherSmall: { fontSize: 9, fontWeight: '700', color: theme.colors.primary, letterSpacing: 0.5 },
  voucherDivider: { width: 1, alignSelf: 'stretch', borderLeftWidth: 1, borderColor: '#FFB3C2', borderStyle: 'dashed' },
  voucherInfo: { flex: 1, paddingHorizontal: 8, gap: 1 },
  voucherCode: { fontSize: 12, fontWeight: '700', color: theme.colors.ink },
  voucherNote: { fontSize: 11, color: theme.colors.muted },

  recentRow: { gap: 8 },
  recentCard: { width: 76, gap: 4 },
  recentPicture: { width: 76, height: 76, borderRadius: theme.radius.md },
});
