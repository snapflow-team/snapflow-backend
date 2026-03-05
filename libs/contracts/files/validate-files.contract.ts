export interface ValidateFilesRequest {
  userId: number;
  fileIds: string[];
}

export interface ValidateFilesResponse {
  validFileIds: string[];
}
