export class UploadAvatarApplicationDto {
  userId: number;
  mimetype: string;
  buffer: Buffer;
  size: number;
  extension: string;
}
