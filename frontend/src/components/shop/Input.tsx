import { StyleSheet, Text, TextInput, type KeyboardTypeOptions } from 'react-native';
import { theme } from '../../theme/theme';

type Props = {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  error?: string;
  multiline?: boolean;
};

export function Input({ label, value, onChangeText, placeholder, keyboardType, error, multiline }: Props) {
  return <>
    {label ? <Text style={styles.label}>{label}</Text> : null}
    <TextInput
      style={[styles.field, multiline && styles.multiline, Boolean(error) && styles.errorBorder]}
      placeholder={placeholder}
      placeholderTextColor="#9CA3AF"
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      multiline={multiline}
      autoCapitalize="sentences"
      accessibilityLabel={label || placeholder}
    />
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </>;
}
const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.ink, marginBottom: 6 },
  field: { height: 46, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#fff', borderRadius: theme.radius.sm, paddingHorizontal: 12, fontSize: 15, color: theme.colors.ink, marginBottom: 12 },
  multiline: { height: 92, paddingVertical: 12, textAlignVertical: 'top' },
  errorBorder: { borderColor: theme.colors.danger },
  error: { color: theme.colors.danger, fontSize: 12, marginTop: -8, marginBottom: 10 },
});
