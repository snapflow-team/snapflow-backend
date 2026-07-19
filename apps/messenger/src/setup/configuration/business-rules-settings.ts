import { IsInt, Min } from 'class-validator';
import { EnvironmentVariable } from './configuration';

const DEFAULT_MESSAGE_EDIT_WINDOW_MS = 15 * 60_000;
const DEFAULT_MESSAGE_DELETE_FOR_EVERYONE_WINDOW_MS = 15 * 60_000;
const DEFAULT_TYPING_TTL_SECONDS = 3;

export class BusinessRulesSettings {
  @IsInt()
  @Min(0)
  messageEditWindowMs: number;

  @IsInt()
  @Min(0)
  messageDeleteForEveryoneWindowMs: number;

  @IsInt()
  @Min(1)
  typingTtlSeconds: number;

  constructor(private readonly environmentVariables: EnvironmentVariable) {
    this.messageEditWindowMs = this.parseIntOrDefault(
      environmentVariables.MESSAGE_EDIT_WINDOW_MS,
      DEFAULT_MESSAGE_EDIT_WINDOW_MS,
      0,
    );
    this.messageDeleteForEveryoneWindowMs = this.parseIntOrDefault(
      environmentVariables.MESSAGE_DELETE_FOR_EVERYONE_WINDOW_MS,
      DEFAULT_MESSAGE_DELETE_FOR_EVERYONE_WINDOW_MS,
      0,
    );
    this.typingTtlSeconds = this.parseIntOrDefault(
      environmentVariables.TYPING_TTL_SECONDS,
      DEFAULT_TYPING_TTL_SECONDS,
      1,
    );
  }

  private parseIntOrDefault(raw: string | undefined, fallback: number, min: number): number {
    if (raw === undefined || raw === '') {
      return fallback;
    }

    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
  }
}
