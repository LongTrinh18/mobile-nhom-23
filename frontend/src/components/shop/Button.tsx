import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { theme } from '../../theme/theme';

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'outline';
  style?: ViewStyle;
};

export function Button({ title, onPress, disabled, loading, variant = 'primary', style }: Props) {
  const outline = variant === 'outline';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.base, outline ? styles.outline : styles.primary,
        (disabled || loading) && styles.disabled, pressed && styles.pressed, style]}
    >
      {loading ? <ActivityIndicator color={outline ? theme.colors.primary : '#fff'} /> :
        <Text style={[styles.text, outline ? styles.outlineText : styles.primaryText]}>{title}</Text>}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  base: { minHeight: 48, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primary: { backgroundColor: theme.colors.primary },
  outline: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.primary },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.85 },
  text: { fontWeight: '700', fontSize: 15 },
  primaryText: { color: '#fff' },
  outlineText: { color: theme.colors.primary },
});
