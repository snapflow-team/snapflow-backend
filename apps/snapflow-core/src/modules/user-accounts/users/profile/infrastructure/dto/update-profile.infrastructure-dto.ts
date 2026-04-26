export class UpdateProfileInfrastructureDto {
  profileId: number;
  firstName: string;
  lastName: string;
  dateOfBirth?: Date | null;
  country?: string | null;
  city?: string | null;
  aboutMe?: string | null;
}
