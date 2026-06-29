export type ProfileFollowListRow = {
  id: number;
  createdAt: Date;
  userId: number;
  username: string;
  avatarUrl: string | null;
  profileId: number;
};
