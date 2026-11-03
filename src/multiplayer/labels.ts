import type { ModeSelection } from '../domain/config';

export function modeLabel(selection: ModeSelection): string {
  switch (selection.mode) {
    case 'normal':
      return 'Normal';
    case 'hard':
      return 'Hard';
    case 'extreme':
      return `Extreme · ${String(selection.frequencyCount)} frequências`;
  }
}

/** Junta nomes em português: "Ana", "Ana e Bia", "Ana, Bia e Caio". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} e ${names.at(-1) ?? ''}`;
}
