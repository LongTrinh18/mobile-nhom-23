import type { ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Button } from '../shop/Button';
import { theme } from '../../theme/theme';

type Props = { icon: ComponentProps<typeof Ionicons>['name']; title: string; description: string; actionLabel?: string; onAction?: () => void };
export function DestinationState({ icon, title, description, actionLabel, onAction }: Props) {
  return <View style={styles.card}>
    <View style={styles.icon}><Ionicons name={icon} size={34} color={theme.colors.primary} /></View>
    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    <Text style={styles.description}>{description}</Text>
    {actionLabel && onAction && <Button title={actionLabel} onPress={onAction} style={styles.action} />}
  </View>;
}
const styles = StyleSheet.create({
  card: { margin: 16, paddingVertical: 32, paddingHorizontal: 24, borderRadius: theme.radius.xl, backgroundColor: theme.colors.surface,
    alignItems: 'center', gap: 12, ...theme.shadow.card },
  icon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primarySoft, marginBottom: 4 },
  title: { fontSize: 19, fontWeight: '800', textAlign: 'center', color: theme.colors.ink },
  description: { fontSize: 14, lineHeight: 21, color: theme.colors.muted, textAlign: 'center' },
  action: { alignSelf: 'stretch', marginTop: 8 },
});
