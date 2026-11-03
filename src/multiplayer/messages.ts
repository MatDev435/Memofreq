import type { ErrorCode } from './protocol';

/** Motivos locais além dos códigos do servidor. */
export type LocalReason =
  | 'connection-failed'
  | 'connection-lost'
  | 'room-closed'
  | 'unavailable'
  | 'invalid-code';

export type MultiplayerReason = ErrorCode | LocalReason;

const MESSAGES: Record<MultiplayerReason, string> = {
  'invalid-name': 'Use um apelido de 1 a 20 caracteres visíveis.',
  'name-taken': 'Esse apelido já está em uso nesta sala. Escolha outro.',
  'room-full': 'A sala está cheia. O limite é de 8 participantes.',
  'room-in-match':
    'Essa sala está em uma partida. Você poderá entrar quando ela voltar ao lobby.',
  'room-not-found':
    'Sala não encontrada. Confira o código ou peça um novo convite.',
  kicked: 'Você foi removido da sala pelo host.',
  inactive: 'Sua conexão ficou inativa por muito tempo e você saiu da sala.',
  'rate-limited':
    'Muitas ações foram enviadas em pouco tempo e a conexão foi encerrada.',
  'invalid-message': 'O servidor não reconheceu essa ação.',
  'not-host': 'Somente o host pode fazer isso.',
  'invalid-phase': 'Essa ação não está disponível neste momento.',
  'invalid-target': 'Esse participante não está mais na sala.',
  'wrong-round': 'Esse palpite não pertence ao round atual.',
  'wrong-attempt': 'Esse palpite está fora de ordem.',
  'already-finished': 'Seus palpites deste round já foram registrados.',
  'invalid-frequency': 'O palpite está fora da faixa permitida.',
  'connection-failed':
    'Não foi possível conectar ao servidor multiplayer. Verifique sua conexão e tente novamente.',
  'connection-lost': 'A conexão com a sala foi perdida.',
  'room-closed': 'A sala foi encerrada.',
  unavailable: 'O multiplayer não está configurado nesta instalação.',
  'invalid-code': 'Digite o código de 10 caracteres recebido no convite.',
};

export function reasonMessage(reason: MultiplayerReason): string {
  return MESSAGES[reason];
}

/** Erros que impedem a entrada; o formulário continua disponível. */
export const JOIN_ERRORS = new Set<MultiplayerReason>([
  'invalid-name',
  'name-taken',
  'room-full',
  'room-in-match',
  'room-not-found',
]);
