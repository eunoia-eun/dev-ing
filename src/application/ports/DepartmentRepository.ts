import type { Department } from '@domain/department/Department';
import type { Id } from '@domain/shared/types';

export interface DepartmentRepository {
  list(): Promise<Department[]>;
  getById(id: Id): Promise<Department | null>;
  save(department: Department): Promise<void>;
  remove(id: Id): Promise<void>;
}
