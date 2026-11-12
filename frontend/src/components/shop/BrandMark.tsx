import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { theme } from '../../theme/theme';

/** Square red wordmark used in the header and on the sign-in screens. */
export function BrandMark({ size = 38 }: { size?: number }) {
  return <View accessibilityRole="image" accessibilityLabel="UNIQLO" style={[styles.box, { width: size, height: size }]}>
    <Text style={[styles.text, { fontSize: size * 0.26, lineHeight: size * 0.3 }]}>UNI{'\n'}QLO</Text>
  </View>;
}
const styles = StyleSheet.create({
  box: { backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontWeight: '900', textAlign: 'center', letterSpacing: 0.4 },
});
