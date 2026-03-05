export interface ConfirmUploadRequest {
  userId: number;
  fileId: string;
}

export interface ConfirmUploadResponse {
  success: boolean;
}
