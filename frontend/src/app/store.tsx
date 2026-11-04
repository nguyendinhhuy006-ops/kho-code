import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Command, Store } from '../shared/domain';

const emptyStore = (): Store => ({ version: 1, users: [], units: [], years: [], plans: [], tasks: [], indicators: [], strategies: [], logs: [] });
interface ContextValue { data: Store; userId: string | null; loading: boolean; warning: string; login: (email: string, password: string) => Promise<void>; logout: () => Promise<void>; dispatch: (command: Command, password?: string) => Promise<void>; changePassword: (currentPassword: string, newPassword: string) => Promise<void> }
const Context = createContext<ContextValue | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Store>(emptyStore);
  const [warning, setWarning] = useState('');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const clear = () => { setUserId(null); setData(emptyStore()); };
  async function request(path: string, input?: unknown) {
    let response: Response;
    try { response = await fetch(path, { method: input === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: input === undefined ? undefined : JSON.stringify(input), signal: AbortSignal.timeout(15_000) }); }
    catch { throw new Error('Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối và thử lại.'); }
    let payload;
    try { payload = await response.json(); } catch { throw new Error('Máy chủ chưa sẵn sàng. Vui lòng thử lại.'); }
    if (!response.ok) { if (response.status === 401 && path !== '/api/auth/login') clear(); throw new Error(payload.message ?? 'Thao tác chưa thành công.'); }
    return payload;
  }
  useEffect(() => {
    let live = true;
    fetch('/api/session', { credentials: 'same-origin', signal: AbortSignal.timeout(10_000) }).then(async response => {
      if (response.status === 401) return;
      if (!response.ok) throw new Error();
      const payload = await response.json(); if (live) { setData(payload.data); setUserId(payload.userId); }
    }).catch(() => { if (live) setWarning('Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối và thử lại.'); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);
  async function login(email: string, password: string) { const payload = await request('/api/auth/login', { email, password }); setData(payload.data); setUserId(payload.userId); setWarning(''); }
  useEffect(() => {
    if (!userId) return;
    let live = true; let pending = false;
    const refresh = async () => {
      if (pending || document.visibilityState === 'hidden') return; pending = true;
      try {
        const response = await fetch('/api/session', { credentials: 'same-origin', signal: AbortSignal.timeout(10_000) });
        if (!live) return;
        if (response.status === 401) { clear(); return; }
        if (response.ok) { const payload = await response.json(); if (live) setData(current => (payload.data.access?.revision ?? 0) > (current.access?.revision ?? 0) ? payload.data : current); }
      } catch { /* Preserve the current session during a temporary network failure. */ }
      finally { pending = false; }
    };
    const timer = window.setInterval(refresh, 15_000); window.addEventListener('focus', refresh);
    return () => { live = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [userId]);
  async function logout() { await request('/api/auth/logout', {}); clear(); }
  async function dispatch(command: Command, password?: string) { const payload = await request('/api/commands', { ...command, ...(password ? { password } : {}) }); setData(payload.data); setUserId(payload.userId); setWarning(''); }
  async function changePassword(currentPassword: string, newPassword: string) { await request('/api/auth/password', { currentPassword, newPassword }); }
  return <Context.Provider value={{ data, userId, loading, warning, login, logout, dispatch, changePassword }}>{children}</Context.Provider>;
}
export function useStore() { const value = useContext(Context); if (!value) throw new Error('Thiếu StoreProvider'); return value; }
