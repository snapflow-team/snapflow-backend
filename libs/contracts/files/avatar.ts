export enum AvatarRpcCommand {
  UploadAvatar = 'upload_avatar',
  DeleteAvatar = 'delete_avatar',
}

export interface UploadAvatarRequest {
  userId: number;
  filename: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface UploadAvatarResponse {
  key: string;
  publicUrl: string;
}

export interface DeleteAvatarRequest {
  userId: number;
}
