export class CreateUserDomainDto {
  username: string;
  email: string;
  password: string;
  confirmationCode: string;
  expirationDate: Date;
}
