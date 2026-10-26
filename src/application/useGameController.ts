import { useEffect, useSyncExternalStore } from 'react';
import type { GameController } from './GameController';

export function useGameController(controller: GameController) {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  useEffect(() => {
    controller.activate();
    document.addEventListener('visibilitychange', controller.visibilityChanged);
    window.addEventListener('pagehide', controller.leave);
    return () => {
      document.removeEventListener(
        'visibilitychange',
        controller.visibilityChanged,
      );
      window.removeEventListener('pagehide', controller.leave);
      controller.deactivate();
      // StrictMode reconecta antes desta microtask; um unmount real descarta a engine.
      queueMicrotask(() => {
        if (!controller.isActive())
          void controller.dispose().catch(() => undefined);
      });
    };
  }, [controller]);
  return snapshot;
}
