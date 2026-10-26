import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CartProvider } from '../context/CartContext';
import { theme } from '../theme/theme';

export default function RootLayout() {
  return (
    <CartProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.ink,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}>
        <Stack.Screen name="index" options={{ title: 'Mobile Nhóm 23' }} />
        <Stack.Screen name="products/index" options={{ title: 'Sản phẩm' }} />
        <Stack.Screen name="products/[id]" options={{ title: 'Chi tiết sản phẩm' }} />
        <Stack.Screen name="cart" options={{ title: 'Giỏ hàng' }} />
        <Stack.Screen name="checkout" options={{ title: 'Đặt hàng COD' }} />
        <Stack.Screen name="account" options={{ title: 'Tài khoản' }} />
      </Stack>
    </CartProvider>
  );
}
