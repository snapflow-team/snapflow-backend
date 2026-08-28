import {
  InvalidOffsetException,
  InvalidRangeException,
  InvalidStateTransitionException,
  SessionExpiredException,
} from './errors';

export enum UploadSessionStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ABORTED = 'ABORTED',
}

export const UPLOAD_SESSION_TRANSITIONS: Record<
  UploadSessionStatus,
  readonly UploadSessionStatus[]
> = {
  [UploadSessionStatus.ACTIVE]: [UploadSessionStatus.COMPLETED, UploadSessionStatus.ABORTED],
  [UploadSessionStatus.COMPLETED]: [],
  [UploadSessionStatus.ABORTED]: [],
};

export interface UploadSessionProps {
  id: string;
  objectId: string;
  ownerUserId: number;
  profile: string;
  status: UploadSessionStatus;
  declaredSize: bigint;
  declaredMime: string;
  chunkSize: bigint;
  storageKey: string;
  multipartId: string | null;
  receivedBytes: bigint;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class UploadSession {
  private constructor(private readonly props: UploadSessionProps) {}

  static create(params: {
    id: string;
    objectId: string;
    ownerUserId: number;
    profile: string;
    declaredSize: bigint;
    declaredMime: string;
    chunkSize: bigint;
    storageKey: string;
    multipartId?: string | null;
    expiresAt: Date;
    now?: Date;
  }): UploadSession {
    const now = params.now ?? new Date();

    return new UploadSession({
      id: params.id,
      objectId: params.objectId,
      ownerUserId: params.ownerUserId,
      profile: params.profile,
      status: UploadSessionStatus.ACTIVE,
      declaredSize: params.declaredSize,
      declaredMime: params.declaredMime,
      chunkSize: params.chunkSize,
      storageKey: params.storageKey,
      multipartId: params.multipartId ?? null,
      receivedBytes: 0n,
      expiresAt: params.expiresAt,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: UploadSessionProps): UploadSession {
    return new UploadSession({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get objectId(): string {
    return this.props.objectId;
  }

  get ownerUserId(): number {
    return this.props.ownerUserId;
  }

  get status(): UploadSessionStatus {
    return this.props.status;
  }

  get declaredSize(): bigint {
    return this.props.declaredSize;
  }

  get chunkSize(): bigint {
    return this.props.chunkSize;
  }

  get receivedBytes(): bigint {
    return this.props.receivedBytes;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get snapshot(): UploadSessionProps {
    return { ...this.props };
  }

  isExpired(now: Date = new Date()): boolean {
    return now.getTime() >= this.props.expiresAt.getTime();
  }

  isComplete(): boolean {
    return this.props.receivedBytes === this.props.declaredSize;
  }

  assertActive(now: Date = new Date()): void {
    if (this.props.status !== UploadSessionStatus.ACTIVE) {
      throw new InvalidStateTransitionException(
        `Upload session is ${this.props.status}, expected ACTIVE`,
      );
    }

    if (this.isExpired(now)) {
      throw new SessionExpiredException();
    }
  }

  recordPart(offset: bigint, partSize: bigint, now: Date = new Date()): void {
    this.assertActive(now);

    if (partSize <= 0n) {
      throw new InvalidRangeException('Part size must be greater than zero');
    }

    if (offset !== this.props.receivedBytes) {
      throw new InvalidOffsetException();
    }

    const nextReceived = offset + partSize;

    if (nextReceived > this.props.declaredSize) {
      throw new InvalidRangeException('Part exceeds declared upload length');
    }

    const isLastPart = nextReceived === this.props.declaredSize;

    if (!isLastPart && partSize !== this.props.chunkSize) {
      throw new InvalidRangeException('Part size must match the session chunk size');
    }

    this.props.receivedBytes = nextReceived;
    this.props.updatedAt = now;
  }

  complete(now: Date = new Date()): void {
    if (this.props.status === UploadSessionStatus.COMPLETED) {
      return;
    }

    this.assertActive(now);

    if (!this.isComplete()) {
      throw new InvalidRangeException('Upload is not fully received');
    }

    this.transitionTo(UploadSessionStatus.COMPLETED, now);
  }

  abort(now: Date = new Date()): void {
    if (this.props.status === UploadSessionStatus.ABORTED) {
      return;
    }

    if (this.props.status !== UploadSessionStatus.ACTIVE) {
      throw new InvalidStateTransitionException(
        `Cannot abort upload session in status ${this.props.status}`,
      );
    }

    this.transitionTo(UploadSessionStatus.ABORTED, now);
  }

  private transitionTo(next: UploadSessionStatus, now: Date): void {
    const allowed = UPLOAD_SESSION_TRANSITIONS[this.props.status];

    if (!allowed.includes(next)) {
      throw new InvalidStateTransitionException(
        `Cannot transition upload session from ${this.props.status} to ${next}`,
      );
    }

    this.props.status = next;
    this.props.updatedAt = now;
  }
}
