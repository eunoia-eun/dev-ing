import type { Account } from '@domain/auth/Account';

export interface IAccountRepository {
  findByEmployeeId(employeeId: string): Promise<Account | null>;
  findByEmployeeNumber(employeeNumber: string): Promise<Account | null>;
  findManagerAccount(): Promise<Account | null>;
  save(account: Account): Promise<void>;
  list(): Promise<Account[]>;
}
