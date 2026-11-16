import type { ComponentProps, ReactNode } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { theme } from '../../theme/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** White rounded surface used to group related content on every screen. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ icon, title, step, right }: { icon?: IconName; title: string; step?: number; right?: ReactNode }) {
  return <View style={styles.sectionRow}>
    {step != null ? <View style={styles.step}><Text style={styles.stepText}>{step}</Text></View>
      : icon ? <Ionicons name={icon} size={19} color={theme.colors.ink} /> : null}
    <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
    {right}
  </View>;
}

export function Checkbox({ checked, onPress, label, disabled }: { checked: boolean; onPress: () => void; label: string; disabled?: boolean }) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked, disabled }}
    disabled={disabled} hitSlop={10} onPress={onPress} style={styles.checkboxHit}>
    <View style={[styles.checkbox, checked && styles.checkboxOn]}>
      {checked && <Ionicons name="checkmark" size={15} color="#fff" />}
    </View>
  </Pressable>;
}

export function Chip({ label, selected, onPress, disabled, unavailable, icon, accessibilityLabel }: {
  label: string; selected?: boolean; onPress: () => void; disabled?: boolean; unavailable?: boolean; icon?: IconName; accessibilityLabel?: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}
    accessibilityState={{ selected: Boolean(selected), disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.chip, selected && styles.chipOn, unavailable && !selected && styles.chipUnavailable, pressed && styles.pressed, disabled && styles.disabled]}>
    {icon && <Ionicons name={icon} size={15} color={selected ? theme.colors.primary : theme.colors.text} />}
    <Text style={[styles.chipText, selected && styles.chipTextOn, unavailable && !selected && styles.chipTextUnavailable]}>{label}</Text>
  </Pressable>;
}

export function Stepper({ value, min = 1, max, onChange, disabled, label = 'số lượng' }: {
  value: number; min?: number; max: number; onChange: (value: number) => void; disabled?: boolean; label?: string;
}) {
  const canDecrease = !disabled && value > min;
  const canIncrease = !disabled && value < max;
  return <View style={styles.stepper}>
    <Pressable accessibilityRole="button" accessibilityLabel={'Giảm ' + label} accessibilityState={{ disabled: !canDecrease }}
      disabled={!canDecrease} onPress={() => onChange(value - 1)} style={[styles.stepButton, !canDecrease && styles.disabled]}>
      <Ionicons name="remove" size={16} color={theme.colors.ink} />
    </Pressable>
    <Text accessibilityLabel={label + ' ' + value} style={styles.stepValue}>{value}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={'Tăng ' + label} accessibilityState={{ disabled: !canIncrease }}
      disabled={!canIncrease} onPress={() => onChange(value + 1)} style={[styles.stepButton, !canIncrease && styles.disabled]}>
      <Ionicons name="add" size={16} color={theme.colors.ink} />
    </Pressable>
  </View>;
}

type Tone = 'info' | 'warning' | 'danger' | 'success' | 'neutral';
const toneColors: Record<Tone, { bg: string; fg: string; icon: IconName }> = {
  info: { bg: theme.colors.infoSoft, fg: theme.colors.info, icon: 'information-circle-outline' },
  warning: { bg: theme.colors.warningSoft, fg: theme.colors.warning, icon: 'warning-outline' },
  danger: { bg: theme.colors.dangerSoft, fg: theme.colors.danger, icon: 'alert-circle-outline' },
  success: { bg: theme.colors.successSoft, fg: theme.colors.success, icon: 'checkmark-circle-outline' },
  neutral: { bg: theme.colors.soft, fg: theme.colors.text, icon: 'information-circle-outline' },
};

/** Inline message box. Never rely on Alert alone: it is a no-op on the web build. */
export function Notice({ tone = 'info', title, children, action }: { tone?: Tone; title?: string; children?: ReactNode; action?: ReactNode }) {
  const colors = toneColors[tone];
  return <View accessibilityRole={tone === 'danger' ? 'alert' : undefined} style={[styles.notice, { backgroundColor: colors.bg }]}>
    <Ionicons name={colors.icon} size={20} color={colors.fg} style={styles.noticeIcon} />
    <View style={styles.noticeBody}>
      {!!title && <Text style={[styles.noticeTitle, { color: colors.fg }]}>{title}</Text>}
      {typeof children === 'string' ? <Text style={[styles.noticeText, { color: colors.fg }]}>{children}</Text> : children}
      {action}
    </View>
  </View>;
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const colors = toneColors[tone];
  return <View style={[styles.badge, { backgroundColor: colors.bg }]}><Text style={[styles.badgeText, { color: colors.fg }]}>{label}</Text></View>;
}

export function Row({ label, value, strong, valueColor }: { label: string; value: string; strong?: boolean; valueColor?: string }) {
  return <View style={styles.row}>
    <Text style={[styles.rowLabel, strong && styles.rowStrong]}>{label}</Text>
    <Text style={[styles.rowValue, strong && styles.rowStrongValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
  </View>;
}

export function Divider() { return <View style={styles.divider} />; }

const styles = StyleSheet.create({
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 14, gap: 12 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.colors.ink },
  step: { width: 20, height: 20, borderRadius: 10, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  checkboxHit: { minWidth: 40, minHeight: theme.touch, alignItems: 'center', justifyContent: 'center' },
  checkbox: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surface,
    alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chip: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, borderRadius: theme.radius.sm,
    borderWidth: 1, borderColor: theme.colors.soft, backgroundColor: theme.colors.soft },
  chipOn: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
  chipUnavailable: { backgroundColor: theme.colors.surface, borderStyle: 'dashed', borderColor: theme.colors.borderStrong },
  chipText: { fontSize: 13, color: theme.colors.text },
  chipTextOn: { color: theme.colors.primary, fontWeight: '600' },
  chipTextUnavailable: { color: theme.colors.subtle, textDecorationLine: 'line-through' },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.35 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface, overflow: 'hidden' },
  stepButton: { width: 32, height: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.soft },
  stepValue: { minWidth: 34, textAlign: 'center', fontSize: 14, fontWeight: '600', color: theme.colors.ink, fontVariant: ['tabular-nums'] },
  notice: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: theme.radius.md },
  noticeIcon: { marginTop: 1 },
  noticeBody: { flex: 1, gap: 6 },
  noticeTitle: { fontSize: 13, fontWeight: '700' },
  noticeText: { fontSize: 12, lineHeight: 18 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  rowLabel: { flex: 1, fontSize: 13, color: theme.colors.muted },
  rowValue: { flexShrink: 1, textAlign: 'right', fontSize: 13, color: theme.colors.ink, fontVariant: ['tabular-nums'] },
  rowStrong: { color: theme.colors.ink, fontWeight: '600', fontSize: 15 },
  rowStrongValue: { color: theme.colors.primary, fontWeight: '700', fontSize: 18 },
  divider: { height: 1, backgroundColor: theme.colors.soft },
});
