import { Notification } from './notification';
import { NotificationResultCode, NotificationResultCodeType } from './notification-result-code';

describe('Notification (Unit)', () => {
  describe('static ok', () => {
    it('должен создавать успешное уведомление с переданными данными', () => {
      const payload = { id: 123, status: 'active' };
      const notification = Notification.ok(payload);

      expect(notification.hasErrors).toBe(false);
      expect(notification.code).toBe(NotificationResultCode.Success);
      expect(notification.message).toBe('Success');
      expect(notification.value).toEqual(payload);
    });

    it('должен корректно работать с null в качестве данных', () => {
      const notification: Notification<null> = Notification.ok(null);
      expect(notification.value).toBeNull();
    });
  });

  describe('static fail', () => {
    it('должен создавать уведомление об ошибке с кодом и сообщением', () => {
      const errorCode: NotificationResultCodeType = NotificationResultCode.BadRequest;
      const errorMessage = 'Некорректный запрос';
      const notification: Notification<null> = Notification.fail(errorCode, errorMessage);

      expect(notification.hasErrors).toBe(true);
      expect(notification.code).toBe(errorCode);
      expect(notification.message).toBe(errorMessage);
    });
  });

  describe('addExtension', () => {
    it('должен добавлять детали ошибки в список extensions', () => {
      const notification: Notification<null> = Notification.fail(
        NotificationResultCode.BadRequest,
        'Ошибка валидации',
      );

      notification.addExtension('email', 'Неверный формат почты');
      notification.addExtension('password', 'Слишком короткий пароль');

      expect(notification.extensions).toHaveLength(2);
      expect(notification.extensions).toEqual([
        {
          field: 'email',
          message: 'Неверный формат почты',
        },
        {
          field: 'password',
          message: 'Слишком короткий пароль',
        },
      ]);
    });
  });

  describe('static copyErrors', () => {
    it('должен копировать код, сообщение и расширения из исходного уведомления', () => {
      const source: Notification<number> = Notification.fail<number>(
        NotificationResultCode.Forbidden,
        'Доступ запрещен',
      );
      source.addExtension('permissions', 'Требуется роль admin');

      const target: Notification<string> = Notification.copyErrors<number, string>(source);

      expect(target.code).toBe(source.code);
      expect(target.message).toBe(source.message);
      expect(target.extensions).toEqual(source.extensions);
      expect(target.extensions).not.toBe(source.extensions);
    });
  });

  describe('get value', () => {
    it('должен возвращать данные, если ошибок нет', () => {
      const notification: Notification<string> = Notification.ok('Данные');
      expect(notification.value).toBe('Данные');
    });

    it('должен выбрасывать исключение при попытке получить value у неудачного уведомления', () => {
      const notification: Notification<null> = Notification.fail(
        NotificationResultCode.NotFound,
        'Объект не найден',
      );

      expect(() => notification.value).toThrow(
        `Can't get value from failed notification. Code: ${NotificationResultCode.NotFound}, Message: Объект не найден`,
      );
    });
  });

  describe('hasErrors', () => {
    it('должен возвращать false, если код равен Success', () => {
      const notification: Notification<boolean> = Notification.ok(true);
      expect(notification.hasErrors).toBe(false);
    });

    it('должен возвращать true, если код отличный от Success', () => {
      const notification: Notification<null> = Notification.fail(
        NotificationResultCode.InternalServerError,
        'Критический сбой',
      );
      expect(notification.hasErrors).toBe(true);
    });
  });
});
