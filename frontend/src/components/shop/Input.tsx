import { useState, type ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, TextInput, View, type KeyboardTypeOptions, type TextInputProps } from 'react-native';
import { fonts, Text } from '../ui/Text';
import { theme } from '../../theme/theme';

type Props = {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  error?: string;
  hint?: string;
  multiline?: boolean;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  maxLength?: number;
  icon?: ComponentProps<typeof Ionicons>['name'];
  editable?: boolean;
};

export function Input({ label, value, onChangeText, placeholder, keyboardType, error, hint, multiline, secureTextEntry,
  autoCapitalize = 'sentences', autoComplete, textContentType, returnKeyType, onSubmitEditing, maxLength, icon, editable = true }: Props) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  return <View style={styles.wrapper}>
    {label ? <Text style={styles.label}>{label}</Text> : null}
    <View style={[styles.field, multiline && styles.multiline, focused && styles.focused, Boolean(error) && styles.errorBorder, !editable && styles.readonly]}>
      {icon && <Ionicons name={icon} size={18} color={focused ? theme.colors.ink : theme.colors.subtle} style={styles.icon} />}
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.subtle}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        secureTextEntry={secureTextEntry && hidden}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        textContentType={textContentType}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        maxLength={maxLength}
        editable={editable}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={label || placeholder}
        accessibilityHint={error || hint}
      />
      {secureTextEntry && <Pressable accessibilityRole="button" accessibilityLabel={hidden ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'}
        hitSlop={8} onPress={() => setHidden(value => !value)} style={styles.toggle}>
        <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={theme.colors.muted} />
      </Pressable>}
    </View>
    {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>
      : hint ? <Text style={styles.hint}>{hint}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  field: { minHeight: 50, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, paddingHorizontal: 14 },
  multiline: { minHeight: 96, alignItems: 'flex-start', paddingVertical: 10 },
  focused: { borderColor: theme.colors.ink },
  errorBorder: { borderColor: theme.colors.danger },
  readonly: { backgroundColor: theme.colors.soft },
  icon: { marginRight: 10 },
  input: { flex: 1, minWidth: 0, fontSize: 15, fontFamily: fonts.regular, color: theme.colors.ink, paddingVertical: 12 },
  inputMultiline: { textAlignVertical: 'top', paddingVertical: 2, minHeight: 72 },
  toggle: { paddingLeft: 10, height: 44, justifyContent: 'center' },
  error: { color: theme.colors.danger, fontSize: 12, lineHeight: 17 },
  hint: { color: theme.colors.muted, fontSize: 12, lineHeight: 17 },
});
