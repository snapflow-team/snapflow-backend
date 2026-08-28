import { IsEnum, IsNumber, IsString, Min } from 'class-validator';
import { Environments } from '../../../../../libs/common/enums/enviroments.enum';
import { EnvironmentVariable } from './configuration';

export enum ClamAvDegradationMode {
  Strict = 'strict',
  Noop = 'noop',
}

export class ClamAvSettings {
  @IsString()
  host: string;

  @IsNumber()
  @Min(1)
  port: number;

  @IsNumber()
  @Min(1000)
  timeoutMs: number;

  @IsEnum(ClamAvDegradationMode)
  degradationMode: ClamAvDegradationMode;

  constructor(private readonly environmentVariables: EnvironmentVariable) {
    this.host = environmentVariables.CLAMAV_HOST;
    this.port = Number(environmentVariables.CLAMAV_PORT);
    this.timeoutMs = Number(environmentVariables.CLAMAV_TIMEOUT_MS);
    this.degradationMode = environmentVariables.CLAMAV_DEGRADATION_MODE as ClamAvDegradationMode;

    const nodeEnv = environmentVariables.NODE_ENV as Environments;

    if (
      nodeEnv === Environments.Production &&
      this.degradationMode === ClamAvDegradationMode.Noop
    ) {
      throw new Error('CLAMAV_DEGRADATION_MODE=noop is not allowed in production');
    }
  }
}
