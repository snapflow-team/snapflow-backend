import {
  InvalidOffsetException,
  InvalidRangeException,
  InvalidStateTransitionException,
  SessionExpiredException,
} from './errors';
import { UploadSession, UploadSessionStatus } from './upload-session.entity';

describe('UploadSession', () => {
  const now = new Date('2026-08-24T10:00:00.000Z');
  const expiresAt = new Date('2026-08-25T10:00:00.000Z');

  const createSession = (overrides: Partial<Parameters<typeof UploadSession.create>[0]> = {}) =>
    UploadSession.create({
      id: '22222222-2222-4222-8222-222222222222',
      objectId: '11111111-1111-4111-8111-111111111111',
      ownerUserId: 7,
      profile: 'message_attachment',
      declaredSize: 12n,
      declaredMime: 'image/jpeg',
      chunkSize: 8n,
      storageKey: 'messenger/2026/08/object/raw',
      multipartId: 'upload-1',
      expiresAt,
      now,
      ...overrides,
    });

  it('records contiguous parts and completes only when the declared size is reached', () => {
    const session = createSession();

    session.recordPart(0n, 8n, now);
    expect(session.receivedBytes).toBe(8n);

    session.recordPart(8n, 4n, now);
    expect(session.isComplete()).toBe(true);

    session.complete(now);
    expect(session.status).toBe(UploadSessionStatus.COMPLETED);
  });

  it('rejects an unexpected offset and a non-final part with the wrong size', () => {
    const session = createSession();

    expect(() => session.recordPart(8n, 4n, now)).toThrow(InvalidOffsetException);

    session.recordPart(0n, 8n, now);
    expect(() => session.recordPart(8n, 3n, now)).toThrow(InvalidRangeException);
  });

  it('rejects complete before the full payload is received', () => {
    const session = createSession();
    session.recordPart(0n, 8n, now);

    expect(() => session.complete(now)).toThrow(InvalidRangeException);
  });

  it('expires active sessions and aborts idempotently', () => {
    const session = createSession();

    expect(() => session.recordPart(0n, 8n, new Date('2026-08-26T00:00:00.000Z'))).toThrow(
      SessionExpiredException,
    );

    session.abort(now);
    expect(session.status).toBe(UploadSessionStatus.ABORTED);
    session.abort(now);
    expect(() => session.complete(now)).toThrow(InvalidStateTransitionException);
  });
});
