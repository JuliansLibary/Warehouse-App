import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { jwtDecode } from 'jwt-decode';
import { RootState } from '../../app/store';
import { setUser, logout, setLoading } from '../../features/launchpad/authSlice';

interface JwtPayload {
  preferred_username: string;
  name?: string;
  email?: string;
  realm_access?: { roles: string[] };
  exp: number;
}

export function useAuth() {
  const dispatch = useDispatch();
  const { isAuthenticated, accessToken, isLoading, user } = useSelector((s: RootState) => s.auth);

  useEffect(() => {
    if (!accessToken) {
      dispatch(setLoading(false));
      return;
    }

    try {
      const decoded = jwtDecode<JwtPayload>(accessToken);
      const isExpired = decoded.exp * 1000 < Date.now();

      if (isExpired) {
        dispatch(logout());
        return;
      }

      dispatch(setUser({
        id: decoded.preferred_username,
        username: decoded.preferred_username,
        displayName: decoded.name ?? decoded.preferred_username,
        email: decoded.email ?? '',
        roles: decoded.realm_access?.roles ?? [],
      }));
    } catch {
      dispatch(logout());
    }
  }, [accessToken]);

  return { isAuthenticated, isLoading, user };
}
