import { Platform } from 'react-native';
import * as ExpoCrypto from 'expo-crypto';

// auth-js needs these WebCrypto operations for CSPRNG + PKCE S256 on Hermes.
// Leave the browser's native implementation untouched.
if (Platform.OS !== 'web') {
  const cryptoObject = globalThis.crypto ?? {};
  if (!('getRandomValues' in cryptoObject)) {
    Object.defineProperty(cryptoObject, 'getRandomValues', { value: ExpoCrypto.getRandomValues });
  }
  if (!('subtle' in cryptoObject)) {
    Object.defineProperty(cryptoObject, 'subtle', { value: {
      digest: async (algorithm: string | { name: string }, data: BufferSource) => {
        const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
        if (name.toUpperCase() !== 'SHA-256') throw new Error('Unsupported digest algorithm');
        return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, data);
      },
    } });
  }
  if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: cryptoObject });
}
