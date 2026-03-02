export class UpdateProfileApplicationDto {
  userId: number;
  username: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  country?: string | null;
  city?: string | null;
  aboutMe?: string | null;
}
