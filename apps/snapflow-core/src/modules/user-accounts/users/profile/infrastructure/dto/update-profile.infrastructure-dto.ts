export class UpdateProfileInfrastructureDto {
  profileId: number;
  username: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: Date | null;
  country?: string | null;
  city?: string | null;
  aboutMe?: string | null;
}
