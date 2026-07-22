import api from './axios';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'member';
  };
}

export const loginAPI = (data: LoginPayload) =>
  api.post<AuthResponse>('/api/auth/login', data);

export const getMeAPI = () =>
  api.get<AuthResponse['user']>('/api/auth/me');

export const refreshAPI = (refresh_token: string) =>
  api.post<{ access_token: string }>('/api/auth/refresh', { refresh_token });
