import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import authService from '../services/authService';
import socketService from '../services/socketService';
import type { User, Computer, LoginData, RegisterData } from '../services/authService';

interface AuthContextType {
  user: User | null;
  computer: Computer | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginData) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [computer, setComputer] = useState<Computer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    const storedUser = authService.getUser();
    const storedComputer = authService.getComputer();

    if (storedUser && token) {
      setUser(storedUser);
      setComputer(storedComputer);
      // Connect socket with stored token
      socketService.connect(token);
    }

    setIsLoading(false);

    // Cleanup on unmount
    return () => {
      socketService.disconnect();
    };
  }, []);

  const login = async (data: LoginData) => {
    try {
      const response = await authService.login(data);
      setUser(response.user);
      setComputer(response.computer || null);
      // Connect socket after successful login
      const token = localStorage.getItem('token');
      if (token) {
        socketService.connect(token);
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const response = await authService.register(data);
      setUser(response.user);
      setComputer(response.computer || null);
      // Connect socket after successful registration
      const token = localStorage.getItem('token');
      if (token) {
        socketService.connect(token);
      }
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const logout = () => {
    // Disconnect socket before logout
    socketService.disconnect();
    authService.logout();
    setUser(null);
    setComputer(null);
  };

  const value = {
    user,
    computer,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
