import { IsInt, Min } from 'class-validator';
import { EnvironmentVariable } from './configuration';

const DEFAULT_MESSAGE_EDIT_WINDOW_MS = 15 * 60_000;
const DEFAULT_MESSAGE_DELETE_FOR_EVERYONE_WINDOW_MS = 15 * 60_000;
const DEFAULT_TYPING_TTL_SECONDS = 3;
const DEFAULT_PRESENCE_HEARTBEAT_TTL_SECONDS = 30;
const DEFAULT_OUTBOX_RETENTION_DAYS = 30;

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

  @IsInt()
  @Min(5)
  presenceHeartbeatTtlSeconds: number;

  @IsInt()
  @Min(1)
  outboxRetentionDays: number;

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
    this.presenceHeartbeatTtlSeconds = this.parseIntOrDefault(
      environmentVariables.PRESENCE_HEARTBEAT_TTL_SECONDS,
      DEFAULT_PRESENCE_HEARTBEAT_TTL_SECONDS,
      5,
    );
    this.outboxRetentionDays = this.parseIntOrDefault(
      environmentVariables.OUTBOX_RETENTION_DAYS,
      DEFAULT_OUTBOX_RETENTION_DAYS,
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
