import type { Account } from '@domain/auth/Account';
import type { IAccountRepository } from '@application/ports/IAccountRepository';
import { LocalStorageStore } from './LocalStorageStore';

export class LocalStorageAccountRepository implements IAccountRepository {
  private store = new LocalStorageStore<Account>('accounts', []);

  async findByEmployeeId(employeeId: string): Promise<Account | null> {
    return this.store.all().find((a) => a.employeeId === employeeId) ?? null;
  }

  async findByEmployeeNumber(employeeNumber: string): Promise<Account | null> {
    return this.store.all().find((a) => a.employeeNumber === employeeNumber) ?? null;
  }

  async findManagerAccount(): Promise<Account | null> {
    return this.store.all().find((a) => a.role === 'manager') ?? null;
  }

  async save(account: Account): Promise<void> {
    this.store.upsert(account);
  }

  async list(): Promise<Account[]> {
    return this.store.all();
  }
}
