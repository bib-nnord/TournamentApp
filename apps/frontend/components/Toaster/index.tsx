"use client";

import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { removeNotification, type Notification } from "@/store/notificationsSlice";
import type { RootState, AppDispatch } from "@/store/store";

const ICONS: Record<Notification["type"], React.ReactNode> = {
  success: (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  ),
  error: (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  ),
};

const STYLES: Record<Notification["type"], string> = {
  success: "bg-white border-emerald-200 text-emerald-700",
  error:   "bg-white border-red-200 text-red-700",
  warning: "bg-white border-amber-200 text-amber-700",
  info:    "bg-white border-indigo-200 text-indigo-700",
};

const PROGRESS_STYLES: Record<Notification["type"], string> = {
  success: "bg-emerald-400",
  error:   "bg-red-400",
  warning: "bg-amber-400",
  info:    "bg-indigo-400",
};

function Toast({ notification }: { notification: Notification }) {
  const dispatch = useDispatch<AppDispatch>();

  function dismiss() {
    dispatch(removeNotification(notification.id));
  }

  useEffect(() => {
    if (!notification.duration) return;
    const timer = setTimeout(dismiss, notification.duration);
    return () => clearTimeout(timer);
  }, [notification.id, notification.duration]);

  // Inline progress bar via a CSS animation using style prop
  const animationDuration = notification.duration ? `${notification.duration}ms` : undefined;

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 w-80 max-w-[calc(100vw-2rem)] rounded-xl border shadow-lg px-4 py-3 text-sm ${STYLES[notification.type]}`}
    >
      <span className="mt-0.5">{ICONS[notification.type]}</span>
      <p className="flex-1 leading-snug text-gray-800">{notification.message}</p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="mt-0.5 shrink-0 opacity-40 hover:opacity-70 transition-opacity"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      {notification.duration > 0 && (
        <span
          className={`absolute bottom-0 left-0 h-[3px] rounded-b-xl ${PROGRESS_STYLES[notification.type]}`}
          style={{
            width: "100%",
            animation: `toast-shrink ${animationDuration} linear forwards`,
          }}
        />
      )}
    </div>
  );
}

export default function Toaster() {
  const notifications = useSelector((state: RootState) => state.notifications.items);

  if (notifications.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 items-end"
    >
      {notifications.map((n) => (
        <div key={n.id} className="relative overflow-hidden rounded-xl">
          <Toast notification={n} />
        </div>
      ))}
    </div>
  );
}
