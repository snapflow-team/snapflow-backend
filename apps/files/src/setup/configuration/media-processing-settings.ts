import { IsNumber, IsString, Min } from 'class-validator';
import { EnvironmentVariable } from './configuration';

export class MediaProcessingSettings {
  @IsString()
  ffmpegPath: string;

  @IsString()
  ffprobePath: string;

  @IsString()
  workerTempDir: string;

  @IsNumber()
  @Min(1)
  maxDurationSeconds: number;

  @IsNumber()
  @Min(1)
  maxInputBytes: number;

  constructor(private readonly environmentVariables: EnvironmentVariable) {
    this.ffmpegPath = environmentVariables.FFMPEG_PATH;
    this.ffprobePath = environmentVariables.FFPROBE_PATH;
    this.workerTempDir = environmentVariables.STORAGE_WORKER_TEMP_DIR;
    this.maxDurationSeconds = Number(environmentVariables.FFMPEG_MAX_DURATION_SECONDS);
    this.maxInputBytes = Number(environmentVariables.FFMPEG_MAX_INPUT_BYTES);
  }
}
