/** Compara a origem do upgrade com a lista separada por vírgulas. */
export function isAllowedOrigin(
  origin: string | null,
  allowed: string,
): boolean {
  if (origin === null) return false;
  return allowed
    .split(',')
    .map((value) => value.trim())
    .some((value) => value !== '' && value === origin);
}
