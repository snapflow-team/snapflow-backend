import { ValidationError } from '@nestjs/common';
import { Extension } from '../damain.exception';
import { formatValidationErrors } from './format-validation-errors';

describe('Утилита formatValidationErrors (Форматирование ошибок валидации)', () => {
  describe('Базовый функционал', () => {
    it('корректно форматирует несколько ошибок для одного поля', () => {
      const errors: ValidationError[] = [
        {
          property: 'username',
          value: 'a!',
          constraints: {
            minLength: 'Username must be between 6 and 30 characters',
            matches: 'Username can only contain 0-9, A-Z, a-z, _, -',
          },
          children: [],
        } as ValidationError,
      ];

      const result: Extension[] = formatValidationErrors(errors);

      expect(result).toHaveLength(2);
      expect(result).toEqual([
        new Extension({
          field: 'username',
          message: 'Username must be between 6 and 30 characters',
        }),
        new Extension({
          field: 'username',
          message: 'Username can only contain 0-9, A-Z, a-z, _, -',
        }),
      ]);
    });

    it('рекурсивно обрабатывает вложенные ошибки и собирает полный путь к полю', () => {
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
                  children: [],
                },
              ],
            },
          ],
        } as ValidationError,
      ];

      const result: Extension[] = formatValidationErrors(errors);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        new Extension({ field: 'user.address.street', message: 'street should not be empty' }),
      );
    });
  });

  describe('Сложные сценарии', () => {
    it('обрабатывает несколько полей на разных уровнях вложенности одновременно', () => {
      const errors: ValidationError[] = [
        {
          property: 'username',
          value: 'usr',
          constraints: { minLength: 'too short' },
          children: [],
        } as ValidationError,
        {
          property: 'profile',
          children: [
            {
              property: 'age',
              value: 15,
              constraints: { min: 'must be 18+' },
              children: [],
            },
          ],
        } as ValidationError,
      ];

      const result: Extension[] = formatValidationErrors(errors);

      const fields = result.map((e) => e.field);
      expect(fields).toContain('username');
      expect(fields).toContain('profile.age');
      expect(result).toHaveLength(2);
    });
  });
});
