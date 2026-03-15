import { UploadFileRequestForGenerateUploadUrls } from '../../../../../../../libs/contracts/files';

export class GeneratedUploadUrlApplicationDto {
  userId: number;
  files: UploadFileRequestForGenerateUploadUrls[];
}
