import type { ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../shop/Button';
import { theme } from '../../theme/theme';

type Props = { icon: ComponentProps<typeof Ionicons>['name']; title: string; description: string; actionLabel?: string; onAction?: () => void };
export function DestinationState({ icon, title, description, actionLabel, onAction }: Props) {
  return <View style={styles.card}>
    <View style={styles.icon}><Ionicons name={icon} size={36} color={theme.colors.primary} /></View>
    <Text style={styles.title}>{title}</Text><Text style={styles.description}>{description}</Text>
    {actionLabel && onAction && <Button title={actionLabel} onPress={onAction} style={{ alignSelf: 'stretch', marginTop: 8 }} />}
  </View>;
}
const styles = StyleSheet.create({
  card: { margin: 20, padding: 24, borderRadius: 16, backgroundColor: theme.colors.surface, alignItems: 'center', gap: 14 },
  icon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1F2' },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', color: theme.colors.ink },
  description: { fontSize: 14, lineHeight: 22, color: theme.colors.muted, textAlign: 'center' },
});
