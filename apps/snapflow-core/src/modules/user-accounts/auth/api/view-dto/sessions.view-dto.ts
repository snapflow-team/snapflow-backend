import { Expose, Transform } from 'class-transformer';
export class SessionView {
  @Expose()
  deviceName: string;

  @Expose()
  id: number;

  @Expose({ name: 'iat' })
  @Transform(({ value }: { value: Date }) => value.toISOString())
  lastVisit: string;
}
