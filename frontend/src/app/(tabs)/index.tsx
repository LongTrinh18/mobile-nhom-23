import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, Image } from 'react-native';
import { CategoryPicture } from '../../components/shop/CategoryPicture';
import { HomeProductSections } from '../../components/shop/HomeProductSections';
import { useCatalog } from '../../features/catalog/useCatalog';
import { useHomeMerchandising } from '../../features/catalog/useHomeMerchandising';
import { useRecentView } from '../../context/RecentViewContext';
import { customerGroups } from '../../data/customer-groups';
import { theme } from '../../theme/theme';
import { formatVnd } from '../../types/shop';

export default function HomeScreen() {
  const catalog = useCatalog();
  const merchandising = useHomeMerchandising();
  const { recentItems, clearRecentItems } = useRecentView();
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
        style={[styles.groupTab, activeIndex === index && styles.activeTab]}>
        <Text style={[styles.groupLabel, activeIndex === index && styles.activeLabel]}>{group.label}</Text>
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

        {/* RECENTLY VIEWED SECTION - Shown only on the first active tab to avoid repetition */}
        {index === 0 && recentItems.length > 0 && (
          <View style={styles.recentSection}>
            <View style={styles.recentHeaderRow}>
              <Text style={styles.recentTitle}>👀 Sản phẩm vừa xem</Text>
              <Pressable onPress={clearRecentItems} hitSlop={10}>
                <Text style={styles.clearRecentBtn}>Xóa lịch sử</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recentScroll}>
              {recentItems.map(item => (
                <Pressable
                  key={item.id}
                  style={styles.recentCard}
                  onPress={() => router.push({ pathname: '/products/[id]', params: { id: item.id } })}
                >
                  <View style={styles.recentImgBox}>
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.recentImg} resizeMode="cover" />
                    ) : (
                      <View style={styles.recentPlaceholder}><Text style={{ fontSize: 24 }}>👕</Text></View>
                    )}
                  </View>
                  <Text style={styles.recentName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.recentPrice}>{formatVnd(item.priceVnd)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <Text style={styles.eyebrow}>{group.label.toLocaleUpperCase('vi')}</Text>
        <HomeProductSections audience={group.key} catalog={catalog} merchandising={merchandising} />
        <Text accessibilityRole="header" style={styles.title}>Danh mục</Text>
        <View style={styles.grid}>
          {group.categories.map(category => <Pressable key={category.key} accessibilityRole="button"
            accessibilityLabel={group.label + ' · ' + category.label} style={styles.category}
            onPress={() => router.push({ pathname: '/products', params: { audience: group.key, section: category.key } })}>
            <CategoryPicture row={group.imageRow} column={category.imageColumn} />
            <View style={styles.caption}><Text style={styles.categoryName}>{category.label}</Text>
              <Ionicons name="chevron-forward" size={15} color={theme.colors.ink} /></View>
          </Pressable>)}
        </View>
        <Pressable accessibilityRole="button" style={styles.allProducts}
          onPress={() => router.push({ pathname: '/products', params: { audience: group.key, section: '' } })}>
          <Text style={styles.allProductsText}>Xem tất cả sản phẩm {group.label.toLocaleLowerCase('vi')}</Text>
          <Ionicons name="arrow-forward" size={19} color={theme.colors.ink} />
        </Pressable>
      </ScrollView>)}
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.surface },
  pager: { flex: 1 },
  groupTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface },
  groupTab: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: theme.colors.primary },
  groupLabel: { fontSize: 15, fontWeight: '500', color: theme.colors.muted },
  activeLabel: { color: theme.colors.ink, fontWeight: '800' },
  pageContent: { padding: 20, paddingBottom: 32 },

  recentSection: { marginBottom: 24, borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingBottom: 16 },
  recentHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  recentTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.ink },
  clearRecentBtn: { fontSize: 12, color: theme.colors.muted, fontWeight: '600', padding: 4 },
  recentScroll: { paddingBottom: 4 },
  recentCard: { width: 110, marginRight: 12 },
  recentImgBox: { width: 110, height: 140, borderRadius: 8, overflow: 'hidden', backgroundColor: '#F3F4F6', marginBottom: 6 },
  recentImg: { width: '100%', height: '100%' },
  recentPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  recentName: { fontSize: 12, fontWeight: '600', color: theme.colors.ink, lineHeight: 16 },
  recentPrice: { fontSize: 13, fontWeight: '800', color: theme.colors.primary, marginTop: 4 },

  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.muted, marginTop: 4, marginBottom: 6 },
  title: { fontSize: 27, fontWeight: '800', color: theme.colors.ink, marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 20 },
  category: { width: '47.8%' },
  caption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 12 },
  categoryName: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.ink },
  allProducts: { minHeight: 52, borderTopWidth: 1, borderTopColor: theme.colors.border, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  allProductsText: { flex: 1, color: theme.colors.ink, fontWeight: '600', fontSize: 14 },
});
