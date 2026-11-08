export type RouteParams = Record<string, string | string[] | undefined>;
type StaticPath = '/' | '/products' | '/cart' | '/checkout' | '/orders' | '/notifications' | '/account' | '/chatbot' | '/auth/login' | '/auth/register';
export type AppTarget = { pathname: StaticPath; params?: Record<string, string> }
  | { pathname: '/products/[id]'; params: Record<string, string> & { id: string } };
export function firstParam(value: string | string[] | undefined) { return (Array.isArray(value) ? value[0] : value) ?? ''; }
const contextKeys = ['origin', 'audience', 'feed', 'collection', 'section', 'q', 'productId', 'variantId', 'quantity', 'mode'] as const;
export function routeContext(params: RouteParams): Record<string, string> {
  return Object.fromEntries(contextKeys.map(key => [key, firstParam(params[key])]).filter(([, value]) => value && value.length <= 500));
}
export function productTarget(id: string, params: RouteParams = {}): AppTarget {
  return { pathname: '/products/[id]', params: { ...routeContext(params), id } };
}
export function browseTarget(params: RouteParams): AppTarget {
  return { pathname: '/products', params: Object.fromEntries(['audience', 'feed', 'collection', 'section', 'q']
    .map(key => [key, firstParam(params[key])]).filter(([, value]) => value && value.length <= 500)) };
}
export function targetUrl(target: AppTarget): string {
  const pathname = target.pathname === '/products/[id]' ? '/products/' + encodeURIComponent(target.params?.id ?? '') : target.pathname;
  const query = Object.entries(target.params ?? {}).filter(([key]) => key !== 'id')
    .map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(value)).join('&');
  return pathname + (query ? '?' + query : '');
}
/** Only recognized in-app destinations and whitelisted context fields survive login redirects. */
export function safeReturnTarget(raw: string): AppTarget {
  if (!raw || raw.length > 2500 || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || raw.includes('#')) return { pathname: '/account' };
  const [pathname, query = ''] = raw.split('?');
  const params: Record<string, string> = {};
  try {
    for (const part of query.split('&')) {
      const equal = part.indexOf('=');
      if (equal < 0) continue;
      const key = decodeURIComponent(part.slice(0, equal));
      if (!(key in params)) params[key] = decodeURIComponent(part.slice(equal + 1).replace(/\+/g, ' '));
    }
  } catch { return { pathname: '/account' }; }
  const context = routeContext(params);
  const detail = pathname.match(/^\/products\/([a-zA-Z0-9-]+)$/);
  if (detail) return productTarget(detail[1], context);
  const allowed = ['/', '/products', '/cart', '/checkout', '/orders', '/notifications', '/account'];
  return allowed.includes(pathname) ? { pathname: pathname as StaticPath, params: context } : { pathname: '/account' };
}
export function loginTarget(destination: AppTarget): AppTarget {
  return { pathname: '/auth/login', params: { returnTo: targetUrl(destination) } };
}
/** Hierarchy wins over visit history; detail preserves its explicit browse origin and filters. */
export function backTarget(pathname: string, params: RouteParams): AppTarget | null {
  if (pathname === '/') return null;
  if (/^\/products\/[^/]+$/.test(pathname)) {
    if (firstParam(params.origin) === 'home') return { pathname: '/' };
    if (firstParam(params.origin) === 'cart') return { pathname: '/cart' };
    return browseTarget(params);
  }
  if (pathname === '/checkout/success') return { pathname: '/orders' };
  if (pathname === '/checkout') {
    const id = firstParam(params.productId);
    return firstParam(params.mode) === 'buy-now' && /^[a-zA-Z0-9-]+$/.test(id) ? productTarget(id, params) : { pathname: '/cart' };
  }
  if (pathname === '/auth/register') return { pathname: '/auth/login', params: { returnTo: targetUrl(safeReturnTarget(firstParam(params.returnTo))) } };
  if (pathname === '/auth/login') {
    const destination = safeReturnTarget(firstParam(params.returnTo));
    return destination.pathname === '/checkout' ? backTarget('/checkout', destination.params ?? {}) : destination;
  }
  if (pathname === '/chatbot' && /^[a-zA-Z0-9-]+$/.test(firstParam(params.productId))) return productTarget(firstParam(params.productId), params);
  return { pathname: '/' };
}
