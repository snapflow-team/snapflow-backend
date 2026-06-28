export type RawUserForSearch = {
  id: number;
  username: string;
  createdAt: Date;
  profiles: { id: number; avatarUrl: string | null }[];
};
