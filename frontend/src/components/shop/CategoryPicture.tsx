import { useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

const atlas = require('../../../assets/images/catalog/category-atlas-v1.png');
/** One locally bundled atlas keeps all category photographs available offline. */
export function CategoryPicture({ row, column }: { row: number; column: number }) {
  const [size, setSize] = useState(0);
  return <View accessible={false} style={styles.frame} onLayout={event => setSize(event.nativeEvent.layout.width)}>
    {size > 0 && <Image source={atlas} accessible={false} contentFit="fill" cachePolicy="memory-disk"
      style={{ position: 'absolute', width: size * 4, height: size * 4, left: -column * size, top: -row * size }} />}
  </View>;
}
const styles = StyleSheet.create({ frame: { width: '100%', aspectRatio: 1, overflow: 'hidden', backgroundColor: '#F4F3F0' } });
