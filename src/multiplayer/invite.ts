import { normalizeRoomCode } from './protocol';

const PARAMETER = 'sala';

/** Lê o código de um fragmento como `#sala=K7Q2M9XH3P`. */
export function readInviteCode(hash: string): string | null {
  const value = new URLSearchParams(hash.replace(/^#/u, '')).get(PARAMETER);
  return value === null ? null : normalizeRoomCode(value);
}

export function inviteHash(code: string): string {
  return `#${PARAMETER}=${code}`;
}

/** Link absoluto para a mesma instalação, preservando subpastas. */
export function inviteUrl(
  location: Pick<Location, 'origin' | 'pathname' | 'search'>,
  code: string,
): string {
  return `${location.origin}${location.pathname}${location.search}${inviteHash(code)}`;
}
