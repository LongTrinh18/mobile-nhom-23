import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { theme } from '../../theme/theme';
import { Text } from './Text';

export const groupDigits = (value: number) => Math.trunc(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Shop-style price: a small "₫" before tabular digits, so prices line up and read at a glance. */
export function Price({ value, size = 16, color = theme.colors.primary, weight = '700', strike, prefix, style }: {
  value: number; size?: number; color?: string; weight?: '500' | '600' | '700'; strike?: boolean; prefix?: string; style?: StyleProp<ViewStyle>;
}) {
  const label = (prefix ?? '') + '₫' + groupDigits(Math.abs(value));
  return <View accessible accessibilityLabel={label} style={[styles.row, style]}>
    {!!prefix && <Text style={{ fontSize: size, color, fontWeight: weight }}>{prefix}</Text>}
    <Text style={[styles.currency, { fontSize: Math.max(10, Math.round(size * 0.68)), color, fontWeight: weight,
      lineHeight: Math.round(size * 1.25) }, strike && styles.strike]}>₫</Text>
    <Text style={[styles.amount, { fontSize: size, color, fontWeight: weight, lineHeight: Math.round(size * 1.25) }, strike && styles.strike]}>
      {groupDigits(Math.abs(value))}
    </Text>
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline' },
  currency: { marginRight: 1 },
  amount: { fontVariant: ['tabular-nums'], letterSpacing: -0.2 },
  strike: { textDecorationLine: 'line-through' },
});
