/** Porta exclusiva do `wrangler dev` iniciado pela suíte de integração. */
export const PORT = Number(process.env.MEMOFREQ_SERVER_TEST_PORT ?? 8798);
export const HTTP_URL = `http://127.0.0.1:${String(PORT)}`;
export const WS_URL = `ws://127.0.0.1:${String(PORT)}`;
export const ALLOWED_ORIGIN = 'http://localhost:5173';
/** Tempos curtos para observar a remoção de conexões silenciosas. */
export const SWEEP_INTERVAL_MS = 500;
export const INACTIVE_AFTER_MS = 1500;
