export type AccountRole = 'manager' | 'employee';

export interface Account {
  id: string;
  /** null = 임직원 테이블과 무관한 관리자 계정 */
  employeeId: string | null;
  /** 로그인 식별자 (사번) */
  employeeNumber: string;
  role: AccountRole;
  hashedPassword: string;
}

export type LoginResult =
  | { success: true; account: Account }
  | { success: false; reason: string };
