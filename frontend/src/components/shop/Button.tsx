import type { ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '../ui/Text';
import { theme } from '../../theme/theme';

type Variant = 'primary' | 'outline' | 'secondary' | 'ghost' | 'danger';
type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: Variant;
  size?: 'md' | 'sm';
  icon?: ComponentProps<typeof Ionicons>['name'];
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const tone: Record<Variant, { background: string; border: string; text: string }> = {
  primary: { background: theme.colors.primary, border: theme.colors.primary, text: '#fff' },
  outline: { background: theme.colors.surface, border: theme.colors.borderStrong, text: theme.colors.ink },
  secondary: { background: theme.colors.primarySoft, border: theme.colors.primarySoft, text: theme.colors.primary },
  ghost: { background: 'transparent', border: 'transparent', text: theme.colors.primary },
  danger: { background: theme.colors.surface, border: theme.colors.danger, text: theme.colors.danger },
};

export function Button({ title, onPress, disabled, loading, variant = 'primary', size = 'md', icon, accessibilityLabel, style }: Props) {
  const colors = tone[variant];
  const inactive = Boolean(disabled || loading);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: Boolean(loading) }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [styles.base, size === 'sm' && styles.small,
        { backgroundColor: colors.background, borderColor: colors.border },
        variant === 'primary' && pressed && { backgroundColor: theme.colors.primaryPressed },
        inactive && styles.disabled, pressed && variant !== 'primary' && styles.pressed, style]}
    >
      {loading ? <ActivityIndicator color={colors.text} /> : <>
        {icon && <Ionicons name={icon} size={size === 'sm' ? 16 : 19} color={colors.text} />}
        <Text numberOfLines={1} style={[styles.text, size === 'sm' && styles.smallText, { color: colors.text }]}>{title}</Text>
      </>}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  base: { minHeight: 46, borderRadius: theme.radius.md, borderWidth: 1, flexDirection: 'row', gap: 8,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  small: { minHeight: 34, paddingHorizontal: 12, borderRadius: theme.radius.sm },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  text: { fontWeight: '600', fontSize: 15, flexShrink: 1 },
  smallText: { fontSize: 13 },
});
