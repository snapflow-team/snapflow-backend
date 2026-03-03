import { IsUUID } from 'class-validator';

export class ConfirmUploadInput {
  @IsUUID() //TODO написать сваггер
  fileId: string;
}
