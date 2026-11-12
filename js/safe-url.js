export function safeHttpsUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;

  const input = value.trim();
  if (!/^https:\/\//i.test(input) || !URL.canParse(input)) return null;

  const url = new URL(input);
  if (url.protocol !== "https:" || url.username || url.password) return null;

  return url.href;
}
