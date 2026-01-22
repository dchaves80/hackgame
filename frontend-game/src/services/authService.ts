import api from './api';

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
}

export interface Computer {
  _id: string;
  ip: string;
  name: string;
  credentials?: {
    username: string;
    password: string;
  };
}

export interface AuthResponse {
  token: string;
  user: User;
  computer?: Computer;
}

class AuthService {
  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/register', data);

    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      if (response.data.computer) {
        localStorage.setItem('computer', JSON.stringify(response.data.computer));
      }
    }

    return response.data;
  }

  async login(data: LoginData): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', data);

    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      if (response.data.computer) {
        localStorage.setItem('computer', JSON.stringify(response.data.computer));
      }
    }

    return response.data;
  }

  async getCurrentUser(): Promise<{ user: User; computers: Computer[] }> {
    const response = await api.get('/auth/me');
    return response.data;
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('computer');
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getUser(): User | null {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  getComputer(): Computer | null {
    const computer = localStorage.getItem('computer');
    return computer ? JSON.parse(computer) : null;
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

export default new AuthService();
