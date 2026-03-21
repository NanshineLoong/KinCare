export function resolveApiBaseUrl(
  value: string | undefined,
  fallbackOrigin: string | undefined = globalThis.location?.origin,
): string {
  const resolved = value ?? fallbackOrigin ?? "";
  return resolved.endsWith("/") ? resolved.slice(0, -1) : resolved;
}


export const apiBaseUrl = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
