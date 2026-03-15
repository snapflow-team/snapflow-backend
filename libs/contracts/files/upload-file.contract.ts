export interface UploadFileRequest {
  userId: number;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface UploadFileResponse {
  key: string;
  publicUrl: string;
}
