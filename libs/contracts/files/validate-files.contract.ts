import { IsArray, IsNumber, IsUUID } from 'class-validator';

export interface ValidateFilesRequest {
  userId: number;
  fileIds: string[];
}

export interface ValidateFilesResponse {
  validFileIds: string[];
}

export class ValidateFilesInputDto implements ValidateFilesRequest {
  @IsNumber()
  userId: number;

  @IsArray()
  @IsUUID(4, { each: true })
  fileIds: string[];
}
