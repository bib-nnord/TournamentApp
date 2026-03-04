import { useState, useCallback } from "react";

export function useConfirmAction(action: () => Promise<void>) {
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  const trigger = useCallback(async () => {
    if (!confirmed) {
      setConfirmed(true);
      return;
    }
    setLoading(true);
    try {
      await action();
    } finally {
      setLoading(false);
      setConfirmed(false);
    }
  }, [confirmed, action]);

  const reset = useCallback(() => setConfirmed(false), []);

  return { confirmed, loading, trigger, reset };
}
