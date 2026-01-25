import { ValidationError } from '@nestjs/common';
import {
  formatValidationErrors,
  ValidationErrorDetail,
} from '../../../../libs/common/exceptions/utils/error-formatter.util';

describe('Утилита formatValidationErrors (Форматирование ошибок валидации)', () => {
  const originalEnv: string | undefined = process.env.NODE_ENV;

  beforeEach(() => {
    jest.resetModules();
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('Базовый функционал', () => {
    it('должна корректно форматировать несколько ошибок для одного поля (например, слишком короткий username с запрещенными символами)', () => {
      process.env.NODE_ENV = 'development';

      const errors: ValidationError[] = [
        {
          property: 'username',
          value: 'a!',
          constraints: {
            minLength: 'Username must be between 6 and 30 characters',
            matches: 'Username can only contain 0-9, A-Z, a-z, _, -',
          },
        },
      ];

      const result: ValidationErrorDetail[] = formatValidationErrors(errors);

      expect(result).toHaveLength(2);
      expect(result).toEqual([
        {
          field: 'username',
          message: 'Username must be between 6 and 30 characters',
          value: 'a!',
        },
        {
          field: 'username',
          message: 'Username can only contain 0-9, A-Z, a-z, _, -',
          value: 'a!',
        },
      ]);
    });

    it('должна рекурсивно обрабатывать вложенные ошибки и собирать полный путь к полю', () => {
      process.env.NODE_ENV = 'development';

      const errors: ValidationError[] = [
        {
          property: 'user',
          children: [
            {
              property: 'address',
              children: [
                {
                  property: 'street',
                  value: '',
                  constraints: {
                    isNotEmpty: 'street should not be empty',
                  },
                },
              ],
            },
          ],
        },
      ];

      const result: ValidationErrorDetail[] = formatValidationErrors(errors);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        field: 'user.address.street',
        message: 'street should not be empty',
        value: '',
      });
    });
  });

  describe('Безопасность и окружение (Production vs Development)', () => {
    it('НЕ должна включать значение (value) в результат, если режим Production', () => {
      process.env.NODE_ENV = 'production';

      const errors: ValidationError[] = [
        {
          property: 'password',
          value: 'secret-123',
          constraints: {
            minLength: 'password too short',
          },
        },
      ];

      const result: ValidationErrorDetail[] = formatValidationErrors(errors);

      expect(result[0].field).toBe('password');
      expect(result[0].message).toBe('password too short');
      expect(result[0]).not.toHaveProperty('value');
    });

    it('должна включать значение (value) в результат в режиме Development', () => {
      process.env.NODE_ENV = 'development';

      const errors: ValidationError[] = [
        {
          property: 'username',
          value: 'admin',
          constraints: {
            isString: 'must be a string',
          },
        },
      ];

      const result: ValidationErrorDetail[] = formatValidationErrors(errors);

      expect(result[0]).toHaveProperty('value', 'admin');
    });
  });

  describe('Сложные сценарии', () => {
    it('должна обрабатывать несколько полей на разных уровнях вложенности одновременно', () => {
      process.env.NODE_ENV = 'development';

      const errors: ValidationError[] = [
        {
          property: 'username',
          value: 'usr',
          constraints: { minLength: 'too short' },
        },
        {
          property: 'profile',
          children: [
            {
              property: 'age',
              value: 15,
              constraints: { min: 'must be 18+' },
            },
          ],
        },
      ];

      const result: ValidationErrorDetail[] = formatValidationErrors(errors);

      const fields: string[] = result.map((e) => e.field);
      expect(fields).toContain('username');
      expect(fields).toContain('profile.age');
      expect(result).toHaveLength(2);
    });
  });
});
