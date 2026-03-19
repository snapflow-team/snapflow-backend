import { MimeType } from './mime-type.enum';

export interface UploadFileRequestForGenerateUploadUrls {
  mimeType: MimeType;
  size: number;
}

export interface GenerateUploadUrlsRequest {
  userId: number;
  files: UploadFileRequestForGenerateUploadUrls[];
}

export interface GenerateUploadUrlResponse {
  uploadUrl: string;
  fileId: string;
}
