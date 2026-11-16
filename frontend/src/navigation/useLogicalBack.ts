import { useCallback } from 'react';
import { useRouter, useFocusEffect, useGlobalSearchParams, usePathname } from 'expo-router';
import { BackHandler, Keyboard } from 'react-native';
import { backTarget, type RouteParams } from './routes';

export function useLogicalBack(blocked = false) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const paramsKey = JSON.stringify(params);
  const goBack = useCallback(() => {
    if (blocked) return true;
    const destination = backTarget(pathname, JSON.parse(paramsKey) as RouteParams);
    if (!destination) return false;
    Keyboard.dismiss();
    router.dismissTo(destination);
    return true;
  }, [blocked, pathname, paramsKey, router]);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => subscription.remove();
  }, [goBack]));
  return goBack;
}
