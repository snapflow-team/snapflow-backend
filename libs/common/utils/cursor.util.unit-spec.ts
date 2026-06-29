import { ValidationException } from '../../exceptions/core';
import { decodeCursor, encodeCursor } from './cursor.util';

describe('Утилиты cursor (encode/decode opaque cursor)', () => {
  const createdAt = new Date('2024-01-01T00:00:00.000Z');
  const id = '123';

  describe('encodeCursor / decodeCursor roundtrip', () => {
    it('корректно кодирует и декодирует payload с Date', () => {
      const cursor = encodeCursor({ createdAt, id });

      expect(cursor).toBe('eyJjcmVhdGVkQXQiOiIyMDI0LTAxLTAxVDAwOjAwOjAwLjAwMFoiLCJpZCI6IjEyMyJ9');
      expect(decodeCursor(cursor)).toEqual({
        createdAt: '2024-01-01T00:00:00.000Z',
        id: '123',
      });
    });

    it('корректно кодирует и декодирует payload с ISO-строкой createdAt', () => {
      const isoCreatedAt = '2024-06-15T12:30:00.000Z';
      const cursor = encodeCursor({ createdAt: isoCreatedAt, id: 'abc-def' });

      expect(decodeCursor(cursor)).toEqual({
        createdAt: isoCreatedAt,
        id: 'abc-def',
      });
    });
  });

  describe('decodeCursor — невалидный cursor', () => {
    const expectInvalidCursor = (cursor: string) => {
      expect(() => decodeCursor(cursor)).toThrow(ValidationException);

      try {
        decodeCursor(cursor);
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationException);
        expect((error as ValidationException).extensions).toEqual([
          { field: 'cursor', message: 'Invalid cursor' },
        ]);
      }
    };

    it('бросает ValidationException для пустого cursor', () => {
      expectInvalidCursor('');
    });

    it('бросает ValidationException для cursor из пробелов', () => {
      expectInvalidCursor('   ');
    });

    it('бросает ValidationException для невалидного base64', () => {
      expectInvalidCursor('not-valid-base64!!!');
    });

    it('бросает ValidationException для невалидного JSON', () => {
      const invalidJsonCursor = Buffer.from('{invalid-json', 'utf8').toString('base64');

      expectInvalidCursor(invalidJsonCursor);
    });

    it('бросает ValidationException для валидного JSON без обязательных полей', () => {
      const missingFieldsCursor = Buffer.from(JSON.stringify({ foo: 'bar' }), 'utf8').toString(
        'base64',
      );

      expectInvalidCursor(missingFieldsCursor);
    });

    it('бросает ValidationException, если createdAt не является валидной датой', () => {
      const invalidDateCursor = Buffer.from(
        JSON.stringify({ createdAt: 'not-a-date', id: '123' }),
        'utf8',
      ).toString('base64');

      expectInvalidCursor(invalidDateCursor);
    });
  });
});
