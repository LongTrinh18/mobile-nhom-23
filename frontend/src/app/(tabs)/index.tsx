import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { CategoryPicture } from '../../components/shop/CategoryPicture';
import { HomeProductSections } from '../../components/shop/HomeProductSections';
import { useCatalog } from '../../features/catalog/useCatalog';
import { useHomeMerchandising } from '../../features/catalog/useHomeMerchandising';
import { customerGroups } from '../../data/customer-groups';
import { theme } from '../../theme/theme';

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
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.8, color: theme.colors.muted, marginTop: 4, marginBottom: 6 },
  title: { fontSize: 27, fontWeight: '800', color: theme.colors.ink, marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 20 },
  category: { width: '47.8%' },
  caption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 12 },
  categoryName: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.ink },
  allProducts: { minHeight: 52, borderTopWidth: 1, borderTopColor: theme.colors.border, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  allProductsText: { flex: 1, color: theme.colors.ink, fontWeight: '600', fontSize: 14 },
});
