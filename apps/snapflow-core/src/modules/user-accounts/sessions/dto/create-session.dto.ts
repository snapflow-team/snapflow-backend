export class CreateSessionDto {
  userId: number;
  deviceId: string;
  userAgent: string;
  ip: string;
  iat: number;
  exp: number;
}
