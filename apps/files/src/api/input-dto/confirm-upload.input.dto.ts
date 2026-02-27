import { IsUUID } from 'class-validator';

export class ConfirmUploadInput {
  @IsUUID()
  fileId: string;
}
