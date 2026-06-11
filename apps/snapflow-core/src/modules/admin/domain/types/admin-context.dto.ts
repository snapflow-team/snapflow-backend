import { AdminRole } from '../enums/admin-role.enum';

export class AdminContextDto {
  role: AdminRole;
  sessionId: string;
}
