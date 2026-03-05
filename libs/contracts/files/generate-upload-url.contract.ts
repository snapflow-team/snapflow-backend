export interface GenerateUploadUrlRequest {
  userId: number;
  mimeType: string;
  size: number;
}

export interface GenerateUploadUrlResponse {
  uploadUrl: string;
  fileId: string;
}
