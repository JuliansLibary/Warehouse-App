import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: {
    id: string;
    username: string;
    displayName: string;
    email: string;
    roles: string[];
  } | null;
  isLoading: boolean;
}

const initialState: AuthState = {
  isAuthenticated: false,
  accessToken: localStorage.getItem('access_token'),
  refreshToken: localStorage.getItem('refresh_token'),
  user: null,
  isLoading: true,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setTokens(state, action: PayloadAction<{ accessToken: string; refreshToken?: string }>) {
      state.accessToken = action.payload.accessToken;
      if (action.payload.refreshToken) {
        state.refreshToken = action.payload.refreshToken;
        localStorage.setItem('refresh_token', action.payload.refreshToken);
      }
      localStorage.setItem('access_token', action.payload.accessToken);
      state.isAuthenticated = true;
      state.isLoading = false;
    },
    setUser(state, action: PayloadAction<AuthState['user']>) {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.isLoading = false;
    },
    logout(state) {
      state.isAuthenticated = false;
      state.accessToken = null;
      state.refreshToken = null;
      state.user = null;
      state.isLoading = false;
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
  },
});

export const { setTokens, setUser, logout, setLoading } = authSlice.actions;
export default authSlice.reducer;
