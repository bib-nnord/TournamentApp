import { createSlice } from '@reduxjs/toolkit';

import { clearAuth, fetchCurrentUser, login, logoutAsync, refreshAccessToken } from './authSlice';
import type { User } from './userTypes';

interface UserState {
  current: User | null;
}

const initialState: UserState = {
  current: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(login.fulfilled, (state, action) => {
        state.current = action.payload.user;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.current = action.payload;
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        state.current = null;
      })
      .addCase(refreshAccessToken.rejected, (state) => {
        state.current = null;
      })
      .addCase(logoutAsync.fulfilled, (state) => {
        state.current = null;
      })
      .addCase(clearAuth, (state) => {
        state.current = null;
      });
  },
});

export default userSlice.reducer;