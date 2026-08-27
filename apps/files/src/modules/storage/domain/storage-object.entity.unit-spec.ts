import {
  InvalidStateTransitionException,
  ObjectNotReadyException,
  OwnershipMismatchException,
  RefCountUnderflowException,
} from './errors';
import { sanitizeOriginalName, StorageObject } from './storage-object.entity';
import { StorageObjectStatus } from '@contracts/storage';

describe('StorageObject', () => {
  const now = new Date('2026-08-24T10:00:00.000Z');

  const createUploading = (): StorageObject =>
    StorageObject.createUploading({
      id: '11111111-1111-4111-8111-111111111111',
      ownerUserId: 7,
      profile: 'message_attachment',
      originalName: 'photos/vacation.jpg',
      now,
    });

  it('создаёт объект в UPLOADING с санитизированным originalName', () => {
    const object = createUploading();

    expect(object.status).toBe(StorageObjectStatus.UPLOADING);
    expect(object.originalName).toBe('vacation.jpg');
    expect(object.refCount).toBe(0);
  });

  it('разрешает только переход UPLOADING → SCANNING → PROCESSING → READY', () => {
    const object = createUploading();

    object.markScanning(now);
    expect(object.status).toBe(StorageObjectStatus.SCANNING);

    object.markProcessing(now);
    expect(object.status).toBe(StorageObjectStatus.PROCESSING);

    object.markReady(
      {
        sha256: 'abc',
        byteSize: 12n,
        mimeType: 'image/jpeg',
      },
      now,
    );

    expect(object.status).toBe(StorageObjectStatus.READY);
    expect(object.isReady()).toBe(true);
  });

  it('разрешает SCANNING → INFECTED и PROCESSING → FAILED как терминальные состояния', () => {
    const infected = createUploading();
    infected.markScanning(now);
    infected.markInfected(now);
    expect(infected.status).toBe(StorageObjectStatus.INFECTED);
    expect(() => infected.markReady({ sha256: 'a', byteSize: 1n, mimeType: 'image/png' })).toThrow(
      InvalidStateTransitionException,
    );

    const failed = createUploading();
    failed.markScanning(now);
    failed.markProcessing(now);
    failed.markFailed('transcode failed', now);
    expect(failed.status).toBe(StorageObjectStatus.FAILED);
    expect(() => failed.markInfected(now)).toThrow(InvalidStateTransitionException);
  });

  it('запрещает пропуск SCANNING', () => {
    const object = createUploading();

    expect(() => object.markProcessing(now)).toThrow(InvalidStateTransitionException);
  });

  it('разрешает attach только для READY и отклоняет чужого владельца', () => {
    const object = createUploading();

    expect(() => object.attach()).toThrow(ObjectNotReadyException);

    object.markScanning(now);
    object.markProcessing(now);
    object.markReady({ sha256: 'abc', byteSize: 12n, mimeType: 'image/jpeg' }, now);
    object.assertOwnedBy(7);
    expect(() => object.assertOwnedBy(8)).toThrow(OwnershipMismatchException);

    object.attach();
    expect(object.refCount).toBe(1);
  });

  it('не позволяет release увести refCount ниже нуля', () => {
    const object = createUploading();
    object.markScanning(now);
    object.markProcessing(now);
    object.markReady({ sha256: 'abc', byteSize: 12n, mimeType: 'image/jpeg' }, now);

    expect(() => object.release()).toThrow(RefCountUnderflowException);

    object.attach();
    object.release();
    expect(object.refCount).toBe(0);
    expect(() => object.release()).toThrow(RefCountUnderflowException);
  });
});

describe('sanitizeOriginalName', () => {
  it('оставляет только basename и вырезает управляющие символы', () => {
    expect(sanitizeOriginalName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeOriginalName('ok\u0000name.png')).toBe('okname.png');
    expect(sanitizeOriginalName('   ')).toBeNull();
  });
});
