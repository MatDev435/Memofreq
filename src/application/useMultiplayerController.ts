import { useEffect, useSyncExternalStore } from 'react';
import type { MultiplayerController } from './MultiplayerController';

export function useMultiplayerController(controller: MultiplayerController) {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  useEffect(() => {
    controller.activate();
    document.addEventListener('visibilitychange', controller.visibilityChanged);
    // Fechar ou recarregar a página sai da sala; não há recuperação de sessão.
    window.addEventListener('pagehide', controller.leave);
    return () => {
      document.removeEventListener(
        'visibilitychange',
        controller.visibilityChanged,
      );
      window.removeEventListener('pagehide', controller.leave);
      controller.deactivate();
      // StrictMode reconecta antes desta microtask; um unmount real sai da sala.
      queueMicrotask(() => {
        if (!controller.isActive())
          void controller.dispose().catch(() => undefined);
      });
    };
  }, [controller]);
  return snapshot;
}
