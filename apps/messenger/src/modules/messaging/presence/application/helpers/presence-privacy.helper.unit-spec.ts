import { UserPresenceSettings } from '@generated/prisma-messenger';
import { isActivityVisible, resolvesShowActivityStatus } from './presence-privacy.helper';

describe('presence-privacy.helper (unit)', () => {
  const settings = (showActivityStatus: boolean): UserPresenceSettings => ({
    userId: 1,
    showActivityStatus,
    lastSeenAt: null,
    updatedAt: new Date('2026-07-19T12:00:00.000Z'),
  });

  describe('resolvesShowActivityStatus', () => {
    it('возвращает true при отсутствии записи', () => {
      expect(resolvesShowActivityStatus(null)).toBe(true);
      expect(resolvesShowActivityStatus(undefined)).toBe(true);
    });

    it('возвращает значение showActivityStatus', () => {
      expect(resolvesShowActivityStatus(settings(true))).toBe(true);
      expect(resolvesShowActivityStatus(settings(false))).toBe(false);
    });
  });

  describe('isActivityVisible', () => {
    it('виден только при взаимном показе', () => {
      expect(isActivityVisible(true, true)).toBe(true);
      expect(isActivityVisible(true, false)).toBe(false);
      expect(isActivityVisible(false, true)).toBe(false);
      expect(isActivityVisible(false, false)).toBe(false);
    });
  });
});
