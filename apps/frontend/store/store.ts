import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import notificationsReducer from './notificationsSlice';
import userReducer from './userSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    user: userReducer,
    notifications: notificationsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
