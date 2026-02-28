import { UserProfile } from '@generated/prisma';

export class ProfileViewDto {
  id: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  country: string | null;
  city: string | null;
  avatarUrl: string | null;
  aboutMe: string | null;
  followersCount: number = 0;
  followingCount: number = 0;
  postsCount: number = 0;

  static mapToView(profile: UserProfile): ProfileViewDto {
    const dto = new this();

    dto.id = profile.id.toString();
    dto.username = profile.username;
    dto.firstName = profile.firstName;
    dto.lastName = profile.lastName;
    dto.dateOfBirth = profile.dateOfBirth ? profile.dateOfBirth.toISOString().split('T')[0] : null;
    dto.country = profile.country;
    dto.city = profile.city;
    dto.avatarUrl = profile.avatarUrl;
    dto.aboutMe = profile.aboutMe;

    return dto;
  }
}
