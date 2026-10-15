import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import socketClient from '../socket/socketClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('token');
      if (savedToken) {
        try {
          const res = await authService.getMe();
          if (res.data?.user) {
            setUser(res.data.user);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            socketClient.connect(res.data.user.id);
          }
        } catch (err) {
          console.warn('Session verification failed:', err.message);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (loginId, password) => {
    const res = await authService.login({ login_id: loginId, password });
    const { user: userData, access_token } = res.data;
    setUser(userData);
    setToken(access_token);
    localStorage.setItem('token', access_token);
    localStorage.setItem('user', JSON.stringify(userData));
    socketClient.connect(userData.id);
    return userData;
  };

  const superAdminLogin = async (email, password) => {
    const res = await authService.superAdminLogin({ email, password });
    const { user: userData, access_token } = res.data;
    setUser(userData);
    setToken(access_token);
    localStorage.setItem('token', access_token);
    localStorage.setItem('user', JSON.stringify(userData));
    socketClient.connect(userData.id);
    return userData;
  };

  const register = async (userData) => {
    const res = await authService.register(userData);
    const { user: newUser, access_token } = res.data;
    setUser(newUser);
    setToken(access_token);
    localStorage.setItem('token', access_token);
    localStorage.setItem('user', JSON.stringify(newUser));
    socketClient.connect(newUser.id);
    return newUser;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore network errors on logout
    }
    socketClient.disconnect();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
  };

  const updateProfile = async (data) => {
    const res = await authService.updateProfile(data);
    const updated = res.data.user;
    setUser(updated);
    localStorage.setItem('user', JSON.stringify(updated));
    return updated;
  };

  const changePassword = async (data) => authService.changePassword(data);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        loading,
        login,
        superAdminLogin,
        register,
        logout,
        updateProfile,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
