import { supabase } from './supabase';

// API client

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const currentProfile = localStorage.getItem('app_current_profile') || 'default-profile';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-id': currentProfile,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string>),
  };

  const res = await fetch(BASE + url, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? res.statusText, body.details);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

// Profiles
export interface ProfileAccount {
  id: string;
  name: string;
}
export const getProfiles = () => request<ProfileAccount[]>('/profiles');
export const createProfile = (name: string) =>
  request<ProfileAccount>('/profiles', { method: 'POST', body: JSON.stringify({ name }) });
export const deleteProfile = (id: string) =>
  request<{ success: boolean; message: string }>(`/profiles/${encodeURIComponent(id)}`, { method: 'DELETE' });

// Dashboard
export const getDashboard = () => request<import('../types').DashboardData>('/dashboard');
export const getPortfolioHistory = (range: string) => request<import('../types').PortfolioPoint[]>(`/portfolio/history?range=${range}`);

// Investments
export const getInvestments = () => request<import('../types').InvestmentWithMetrics[]>('/investments');
export const createInvestment = (data: { name: string; category: string }) =>
  request<import('../types').Investment>('/investments', { method: 'POST', body: JSON.stringify(data) });
export const getInvestment = (id: number) => request<import('../types').InvestmentDetail>(`/investments/${id}`);
export const updateInvestment = (id: number, data: Partial<{ name: string; category: string }>) =>
  request<import('../types').InvestmentDetail>(`/investments/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteInvestment = (id: number) =>
  request<void>(`/investments/${id}`, { method: 'DELETE' });
export const getInvestmentHistory = (id: number, range: string) =>
  request<import('../types').PortfolioPoint[]>(`/investments/${id}/history?range=${range}`);

// Transactions
export const getTransactions = (investmentId: number, params?: Record<string, string>) => {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request<import('../types').Transaction[]>(`/investments/${investmentId}/transactions${qs}`);
};
export const createTransaction = (investmentId: number, data: Omit<import('../types').Transaction, 'id' | 'investment_id' | 'created_at'>) =>
  request<import('../types').Transaction>(`/investments/${investmentId}/transactions`, { method: 'POST', body: JSON.stringify(data) });
export const updateTransaction = (id: number, data: Partial<Omit<import('../types').Transaction, 'id' | 'investment_id' | 'created_at'>>) =>
  request<import('../types').Transaction>(`/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteTransaction = (id: number) =>
  request<void>(`/transactions/${id}`, { method: 'DELETE' });

// Settings
export const getSettings = () => request<import('../types').Settings>('/settings');
export const updateSettings = (data: import('../types').Settings) =>
  request<import('../types').Settings>('/settings', { method: 'PUT', body: JSON.stringify(data) });
export const deleteAccount = () =>
  request<{ success: boolean; message: string }>('/settings/account', { method: 'DELETE' });

// Export / Import
export const exportJSON = () => window.open('/api/export/json', '_blank');
export const exportCSV = () => window.open('/api/export/csv', '_blank');
export const importJSON = (data: unknown) =>
  request<{ success: boolean; invested: number; transactions: number }>('/import/json', { method: 'POST', body: JSON.stringify(data) });

