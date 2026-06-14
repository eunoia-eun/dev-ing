import type { Account, AccountRole, LoginResult } from '@domain/auth/Account';
import type { Employee } from '@domain/employee/Employee';
import type { IAccountRepository } from '@application/ports/IAccountRepository';
import type { IPasswordHasher } from '@application/ports/IPasswordHasher';
import type { EmployeeRepository } from '@application/ports/EmployeeRepository';
import type { IdGenerator } from '@application/ports/system';

export const DEFAULT_MANAGER_NUMBER = 'admin';
const DEFAULT_MANAGER_PASSWORD = 'admin1234';

export class AuthService {
  constructor(
    private readonly accounts: IAccountRepository,
    private readonly employees: EmployeeRepository,
    private readonly hasher: IPasswordHasher,
    private readonly ids: IdGenerator,
  ) {}

  /** 앱 시작 시 관리자 계정이 없으면 기본 계정을 생성한다. */
  async initialize(): Promise<void> {
    const existing = await this.accounts.findManagerAccount();
    if (!existing) {
      await this.accounts.save({
        id: this.ids.next(),
        employeeId: null,
        employeeNumber: DEFAULT_MANAGER_NUMBER,
        role: 'manager',
        hashedPassword: await this.hasher.hash(DEFAULT_MANAGER_PASSWORD),
      });
    }
  }

  async login(
    employeeNumber: string,
    password: string,
    role: AccountRole,
  ): Promise<LoginResult & { employee?: Employee | null }> {
    if (role === 'manager') {
      return this._loginManager(employeeNumber, password);
    }
    return this._loginEmployee(employeeNumber, password);
  }

  private async _loginManager(
    employeeNumber: string,
    password: string,
  ): Promise<LoginResult & { employee?: null }> {
    const account = await this.accounts.findManagerAccount();
    if (!account || account.employeeNumber !== employeeNumber) {
      return { success: false, reason: '사번 또는 비밀번호가 올바르지 않습니다.' };
    }
    const ok = await this.hasher.verify(password, account.hashedPassword);
    if (!ok) return { success: false, reason: '사번 또는 비밀번호가 올바르지 않습니다.' };
    return { success: true, account, employee: null };
  }

  private async _loginEmployee(
    employeeNumber: string,
    password: string,
  ): Promise<LoginResult & { employee?: Employee | null }> {
    const all = await this.employees.list();
    const employee = all.find((e) => e.employeeNumber === employeeNumber && e.active);
    if (!employee) {
      return { success: false, reason: '등록된 임직원 사번을 찾을 수 없습니다.' };
    }

    const account = await this.accounts.findByEmployeeId(employee.id);

    if (!account) {
      // 첫 로그인: 생년월일(YYYYMMDD)을 초기 비밀번호로 사용
      const defaultPw = employee.birthDate?.replace(/-/g, '') ?? '';
      if (!defaultPw) {
        return { success: false, reason: '생년월일 정보가 없어 초기 비밀번호를 설정할 수 없습니다. 보건관리자에게 문의하세요.' };
      }
      if (password !== defaultPw) {
        return { success: false, reason: '비밀번호가 올바르지 않습니다. (초기 비밀번호: 생년월일 8자리 YYYYMMDD)' };
      }
      const newAccount: Account = {
        id: this.ids.next(),
        employeeId: employee.id,
        employeeNumber,
        role: 'employee',
        hashedPassword: await this.hasher.hash(password),
      };
      await this.accounts.save(newAccount);
      return { success: true, account: newAccount, employee };
    }

    const ok = await this.hasher.verify(password, account.hashedPassword);
    if (!ok) return { success: false, reason: '비밀번호가 올바르지 않습니다.' };
    return { success: true, account, employee };
  }

  async changePassword(
    accountId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const account = await this.accounts.list().then((all) => all.find((a) => a.id === accountId));
    if (!account) throw new Error('계정을 찾을 수 없습니다.');
    const ok = await this.hasher.verify(currentPassword, account.hashedPassword);
    if (!ok) throw new Error('현재 비밀번호가 올바르지 않습니다.');
    if (newPassword.length < 6) throw new Error('비밀번호는 6자 이상이어야 합니다.');
    await this.accounts.save({ ...account, hashedPassword: await this.hasher.hash(newPassword) });
  }

  /** 관리자: 임직원 비밀번호를 생년월일로 초기화 */
  async resetEmployeePassword(employeeId: string): Promise<void> {
    const all = await this.employees.list();
    const employee = all.find((e) => e.id === employeeId);
    if (!employee) throw new Error('임직원을 찾을 수 없습니다.');
    const defaultPw = employee.birthDate?.replace(/-/g, '') ?? '';
    if (!defaultPw) throw new Error('생년월일 정보가 없어 초기화할 수 없습니다.');

    const account = await this.accounts.findByEmployeeId(employeeId);
    if (account) {
      await this.accounts.save({ ...account, hashedPassword: await this.hasher.hash(defaultPw) });
    }
    // 계정이 없으면 이미 초기 상태이므로 아무것도 안 함
  }

  async listAccounts(): Promise<Account[]> {
    return this.accounts.list();
  }

  async updateManagerNumber(accountId: string, newNumber: string): Promise<void> {
    const all = await this.accounts.list();
    const account = all.find((a) => a.id === accountId && a.role === 'manager');
    if (!account) throw new Error('관리자 계정을 찾을 수 없습니다.');
    const dup = all.find((a) => a.employeeNumber === newNumber && a.id !== accountId);
    if (dup) throw new Error('이미 사용 중인 사번입니다.');
    await this.accounts.save({ ...account, employeeNumber: newNumber });
  }
}
