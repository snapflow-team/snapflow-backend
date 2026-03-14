export interface UploadFileRequest {
  userId: number;
  filename: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface UploadFileResponse {
  key: string;
  publicUrl: string;
}
