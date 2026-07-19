import { api, ApiError } from '../../api/client';

export interface User {
  email: string;
  name: string;
}

export function initials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return (email[0] ?? '?').toUpperCase();
  return parts
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export const authApi = {
  inviteRequired: async () => {
    const cfg = await api.get<{ inviteRequired?: boolean }>('/auth/config');
    return cfg?.inviteRequired ?? false;
  },
  login: (email: string, password: string) =>
    api.post<User>('/auth/login', { email, password }),
  register: (body: {
    name: string;
    email: string;
    password: string;
    inviteCode?: string;
  }) => api.post<User>('/auth/register', body),
  me: async (): Promise<User | null> => {
    try {
      const u = await api.get<User | null>('/auth/me');
      return u && u.email ? u : null;
    } catch (e) {
      if (e instanceof ApiError && e.isUnauthorized) return null;
      throw e;
    }
  },
  logout: () => api.post<void>('/auth/logout'),
};
