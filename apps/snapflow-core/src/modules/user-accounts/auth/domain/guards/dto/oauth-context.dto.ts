import { OAuthProvider } from '@generated/prisma-snapflow';

export class OAuthContextDto {
  provider: OAuthProvider;
  id: string;
  email: string | null;
  username: string | null;
}
