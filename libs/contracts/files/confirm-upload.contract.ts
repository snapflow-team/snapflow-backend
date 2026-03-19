export interface ConfirmUploadRequest {
  userId: number;
  fileIds: string[];
}

export interface ConfirmUploadResponse {
  success: boolean;
}
