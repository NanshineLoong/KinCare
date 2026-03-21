const usernamePattern = /^[A-Za-z0-9_\-\u3400-\u4DBF\u4E00-\u9FFF]{3,24}$/u;

export function normalizeUsername(value: string): string {
  return value.normalize("NFKC").trim();
}

export function isValidUsername(value: string): boolean {
  return usernamePattern.test(normalizeUsername(value));
}
