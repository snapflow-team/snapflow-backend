export interface DeleteFileRequest {
  userId: number;
  fileUrl: string;
}

export interface DeleteFileResponse {
  success: boolean;
}
