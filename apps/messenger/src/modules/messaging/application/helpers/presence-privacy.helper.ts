import { UserPresenceSettings } from '@generated/prisma-messenger';

/** Отсутствие записи трактуется как «показывать активность». */
export function resolvesShowActivityStatus(
  settings: UserPresenceSettings | null | undefined,
): boolean {
  return settings?.showActivityStatus ?? true;
}

/** Статус между A и B виден только если оба показывают активность (взаимная приватность). */
export function isActivityVisible(viewerShows: boolean, targetShows: boolean): boolean {
  return viewerShows && targetShows;
}
