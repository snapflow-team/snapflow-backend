import { StorageObjectStatus } from '@contracts/storage';
import {
  InvalidStateTransitionException,
  ObjectNotReadyException,
  OwnershipMismatchException,
  RefCountUnderflowException,
} from './errors';

export const STORAGE_OBJECT_TRANSITIONS: Record<
  StorageObjectStatus,
  readonly StorageObjectStatus[]
> = {
  [StorageObjectStatus.UPLOADING]: [StorageObjectStatus.SCANNING],
  [StorageObjectStatus.SCANNING]: [
    StorageObjectStatus.PROCESSING,
    StorageObjectStatus.FAILED,
    StorageObjectStatus.INFECTED,
  ],
  [StorageObjectStatus.PROCESSING]: [
    StorageObjectStatus.READY,
    StorageObjectStatus.FAILED,
    StorageObjectStatus.INFECTED,
  ],
  [StorageObjectStatus.READY]: [],
  [StorageObjectStatus.FAILED]: [],
  [StorageObjectStatus.INFECTED]: [],
};

export type StorageScanStatus = 'pending' | 'clean' | 'infected' | 'skipped';

export interface StorageObjectProps {
  id: string;
  ownerUserId: number;
  profile: string;
  status: StorageObjectStatus;
  sha256: string | null;
  byteSize: bigint | null;
  mimeType: string | null;
  originalName: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  metadata: Record<string, unknown> | null;
  scanStatus: StorageScanStatus | null;
  refCount: number;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  readyAt: Date | null;
  deletedAt: Date | null;
}

const ORIGINAL_NAME_MAX_LENGTH = 255;

export function sanitizeOriginalName(fileName: string | null | undefined): string | null {
  if (fileName === null || fileName === undefined) {
    return null;
  }

  const basename = fileName.split(/[/\\]/).pop() ?? '';
  const sanitized = Array.from(basename)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('')
    .trim();

  if (sanitized.length === 0) {
    return null;
  }

  return sanitized.slice(0, ORIGINAL_NAME_MAX_LENGTH);
}

export class StorageObject {
  private constructor(private readonly props: StorageObjectProps) {}

  static createUploading(params: {
    id: string;
    ownerUserId: number;
    profile: string;
    originalName?: string | null;
    now?: Date;
  }): StorageObject {
    const now = params.now ?? new Date();

    return new StorageObject({
      id: params.id,
      ownerUserId: params.ownerUserId,
      profile: params.profile,
      status: StorageObjectStatus.UPLOADING,
      sha256: null,
      byteSize: null,
      mimeType: null,
      originalName: sanitizeOriginalName(params.originalName),
      width: null,
      height: null,
      durationMs: null,
      metadata: null,
      scanStatus: null,
      refCount: 0,
      failureReason: null,
      createdAt: now,
      updatedAt: now,
      readyAt: null,
      deletedAt: null,
    });
  }

  static reconstitute(props: StorageObjectProps): StorageObject {
    return new StorageObject({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get ownerUserId(): number {
    return this.props.ownerUserId;
  }

  get profile(): string {
    return this.props.profile;
  }

  get status(): StorageObjectStatus {
    return this.props.status;
  }

  get sha256(): string | null {
    return this.props.sha256;
  }

  get byteSize(): bigint | null {
    return this.props.byteSize;
  }

  get mimeType(): string | null {
    return this.props.mimeType;
  }

  get originalName(): string | null {
    return this.props.originalName;
  }

  get refCount(): number {
    return this.props.refCount;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  get snapshot(): StorageObjectProps {
    return { ...this.props };
  }

  isReady(): boolean {
    return this.props.status === StorageObjectStatus.READY && this.props.deletedAt === null;
  }

  assertOwnedBy(ownerUserId: number): void {
    if (this.props.ownerUserId !== ownerUserId) {
      throw new OwnershipMismatchException();
    }
  }

  markScanning(now: Date = new Date()): void {
    this.transitionTo(StorageObjectStatus.SCANNING, now);
    this.props.scanStatus = 'pending';
  }

  markProcessing(now: Date = new Date()): void {
    this.transitionTo(StorageObjectStatus.PROCESSING, now);
    this.props.scanStatus = this.props.scanStatus ?? 'clean';
  }

  markReady(
    params: {
      sha256: string;
      byteSize: bigint;
      mimeType: string;
      width?: number | null;
      height?: number | null;
      durationMs?: number | null;
      metadata?: Record<string, unknown> | null;
    },
    now: Date = new Date(),
  ): void {
    this.transitionTo(StorageObjectStatus.READY, now);
    this.props.sha256 = params.sha256;
    this.props.byteSize = params.byteSize;
    this.props.mimeType = params.mimeType;
    this.props.width = params.width ?? this.props.width;
    this.props.height = params.height ?? this.props.height;
    this.props.durationMs = params.durationMs ?? this.props.durationMs;
    this.props.metadata = params.metadata ?? this.props.metadata;
    this.props.readyAt = now;
    this.props.failureReason = null;
  }

  markFailed(reason: string, now: Date = new Date()): void {
    this.transitionTo(StorageObjectStatus.FAILED, now);
    this.props.failureReason = reason;
  }

  markInfected(now: Date = new Date()): void {
    this.transitionTo(StorageObjectStatus.INFECTED, now);
    this.props.scanStatus = 'infected';
  }

  recordAcceptedBytes(params: {
    sha256: string;
    byteSize: bigint;
    mimeType: string;
    now?: Date;
  }): void {
    this.props.sha256 = params.sha256;
    this.props.byteSize = params.byteSize;
    this.props.mimeType = params.mimeType;
    this.props.updatedAt = params.now ?? new Date();
  }

  attach(): void {
    if (!this.isReady()) {
      throw new ObjectNotReadyException();
    }

    this.props.refCount += 1;
    this.props.updatedAt = new Date();
  }

  release(): void {
    if (this.props.refCount <= 0) {
      throw new RefCountUnderflowException();
    }

    this.props.refCount -= 1;
    this.props.updatedAt = new Date();
  }

  markDeleted(now: Date = new Date()): void {
    this.props.deletedAt = now;
    this.props.updatedAt = now;
  }

  private transitionTo(next: StorageObjectStatus, now: Date): void {
    const allowed = STORAGE_OBJECT_TRANSITIONS[this.props.status];

    if (!allowed.includes(next)) {
      throw new InvalidStateTransitionException(
        `Cannot transition storage object from ${this.props.status} to ${next}`,
      );
    }

    this.props.status = next;
    this.props.updatedAt = now;
  }
}
