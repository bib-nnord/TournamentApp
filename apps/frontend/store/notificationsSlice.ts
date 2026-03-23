import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration: number; // ms, 0 = persist until dismissed
}

interface NotificationsState {
  items: Notification[];
}

const initialState: NotificationsState = { items: [] };

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addNotification(state, action: PayloadAction<Omit<Notification, 'id'>>) {
      state.items.push({
        id: `${Date.now()}-${Math.random()}`,
        ...action.payload,
      });
    },
    removeNotification(state, action: PayloadAction<string>) {
      state.items = state.items.filter((n) => n.id !== action.payload);
    },
  },
});

export const { addNotification, removeNotification } = notificationsSlice.actions;
export default notificationsSlice.reducer;
