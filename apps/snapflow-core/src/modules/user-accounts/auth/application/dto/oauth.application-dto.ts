import { OAuthProvider } from '@generated/prisma';

export class OAuthApplicationDto {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string | null;
  username: string | null;
  ip: string;
  userAgent: string;
}
