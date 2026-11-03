import type { RoomObject } from './RoomObject';

export interface Env {
  readonly ROOMS: DurableObjectNamespace<RoomObject>;
  /** Origens separadas por vírgula, por exemplo `https://memofreq.vercel.app`. */
  readonly ALLOWED_ORIGINS: string;
  /** Opcionais, em milissegundos; padrões de 30 s e 75 s no código. */
  readonly SWEEP_INTERVAL_MS?: string;
  readonly INACTIVE_AFTER_MS?: string;
}

/** Cabeçalhos internos definidos pelo Worker ao encaminhar para a sala. */
export const INTENT_HEADER = 'X-Memofreq-Intent';
export const ROOM_CODE_HEADER = 'X-Memofreq-Room';
export type Intent = 'create' | 'join';
