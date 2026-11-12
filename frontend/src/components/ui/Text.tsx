import { createContext, useContext } from 'react';
import { Text as NativeText, StyleSheet, type TextProps, type TextStyle } from 'react-native';

/** Be Vietnam Pro: designed for Vietnamese diacritics, with even, readable digits. Loaded in app/_layout.tsx. */
export const fonts = {
  regular: 'BeVietnamPro_400Regular',
  medium: 'BeVietnamPro_500Medium',
  semibold: 'BeVietnamPro_600SemiBold',
  bold: 'BeVietnamPro_700Bold',
} as const;

type Weight = 400 | 500 | 600 | 700;
function toWeight(value: TextStyle['fontWeight'] | undefined): Weight | undefined {
  if (value == null) return undefined;
  const numeric = value === 'bold' ? 700 : value === 'normal' ? 400 : Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  // One bold cut keeps headings, prices and buttons consistent (no 800/900 "shouting").
  return numeric >= 700 ? 700 : numeric >= 600 ? 600 : numeric >= 500 ? 500 : 400;
}
export const fontFor = (weight: Weight) => weight === 700 ? fonts.bold : weight === 600 ? fonts.semibold : weight === 500 ? fonts.medium : fonts.regular;

const InheritedWeight = createContext<Weight>(400);

/**
 * Drop-in replacement for React Native's Text. Android cannot pick a weight from a single
 * custom family, so each weight maps to its own font file; nested Text inherits the parent weight.
 */
export function Text({ style, ...props }: TextProps) {
  const inherited = useContext(InheritedWeight);
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const weight = toWeight(flat?.fontWeight) ?? inherited;
  const family = flat?.fontFamily ?? fontFor(weight);
  return <InheritedWeight.Provider value={weight}>
    <NativeText {...props} style={[style, { fontFamily: family, fontWeight: 'normal' }]} />
  </InheritedWeight.Provider>;
}
