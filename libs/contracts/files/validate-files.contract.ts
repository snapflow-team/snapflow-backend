export interface ValidateFilesRequest {
  userId: number;
  fileIds: string[];
}

export interface ValidatedFile {
  fileId: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface ValidateFilesResponse {
  valid: boolean;
  files: ValidatedFile[];
}
