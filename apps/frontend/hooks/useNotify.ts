import { useDispatch } from 'react-redux';
import { useCallback } from 'react';
import type { AppDispatch } from '@/store/store';
import { addNotification, type NotificationType } from '@/store/notificationsSlice';

const DEFAULT_DURATION = 4000;

export function useNotify() {
  const dispatch = useDispatch<AppDispatch>();

  const notify = useCallback(
    (type: NotificationType, message: string, duration = DEFAULT_DURATION) => {
      dispatch(addNotification({ type, message, duration }));
    },
    [dispatch],
  );

  return {
    success: (message: string, duration?: number) => notify('success', message, duration),
    error:   (message: string, duration?: number) => notify('error',   message, duration),
    warning: (message: string, duration?: number) => notify('warning', message, duration),
    info:    (message: string, duration?: number) => notify('info',    message, duration),
  };
}
