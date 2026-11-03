/**
 * Valida a URL do backend multiplayer. Aceita somente `ws:` ou `wss:`, sem
 * query nem fragmento, e remove a barra final.
 */
export function parseMultiplayerUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') return null;
    if (url.search !== '' || url.hash !== '' || url.username !== '')
      return null;
    return url.href.replace(/\/+$/u, '');
  } catch {
    return null;
  }
}

/** Único ponto de leitura de `VITE_MULTIPLAYER_URL`; `null` desativa o modo. */
export const MULTIPLAYER_URL = parseMultiplayerUrl(
  import.meta.env.VITE_MULTIPLAYER_URL,
);
