import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { AccountRole } from '@domain/auth/Account';
import { useServices } from './ServicesContext';

export interface AuthSession {
  accountId: string;
  role: AccountRole;
  employeeId: string | null;
  employeeName: string | null;
  employeeNumber: string;
}

interface AuthCtx {
  session: AuthSession | null;
  ready: boolean;
  login: (
    employeeNumber: string,
    password: string,
    role: AccountRole,
  ) => Promise<{ success: boolean; reason?: string }>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);
const SESSION_KEY = 'whm:session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const { auth } = useServices();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as AuthSession) : null;
    } catch {
      return null;
    }
  });

  // 앱 시작 시 관리자 계정 초기화
  useEffect(() => {
    auth.initialize().finally(() => setReady(true));
  }, [auth]);

  const login = useCallback(
    async (
      employeeNumber: string,
      password: string,
      role: AccountRole,
    ): Promise<{ success: boolean; reason?: string }> => {
      const result = await auth.login(employeeNumber, password, role);
      if (!result.success) return { success: false, reason: result.reason };

      const newSession: AuthSession = {
        accountId: result.account.id,
        role: result.account.role,
        employeeId: result.account.employeeId,
        employeeName: result.employee?.name ?? null,
        employeeNumber: result.account.employeeNumber,
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
      setSession(newSession);
      return { success: true };
    },
    [auth],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  }, []);

  return <Ctx.Provider value={{ session, ready, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth는 AuthProvider 안에서만 사용할 수 있습니다.');
  return ctx;
}
