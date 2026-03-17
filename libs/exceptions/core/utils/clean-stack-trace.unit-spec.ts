import { cleanStackTrace } from './clean-stack-trace';

describe('cleanStackTrace utility', () => {
  let originalCwd: () => string;
  const FAKE_PROJECT_ROOT = '/home/vilyam/projects/snapflow-backend';

  beforeAll(() => {
    // Сохраняем оригинальный метод
    originalCwd = process.cwd;
    // Мокаем процесс, чтобы он всегда возвращал фиксированный путь к проекту
    process.cwd = jest.fn().mockReturnValue(FAKE_PROJECT_ROOT);
  });

  afterAll(() => {
    // Возвращаем оригинальный метод на место
    process.cwd = originalCwd;
  });

  it('должен возвращать пустую строку, если стек не передан', () => {
    expect(cleanStackTrace()).toBe('');
    expect(cleanStackTrace(undefined)).toBe('');
    expect(cleanStackTrace('')).toBe('');
  });

  it('должен сохранять сообщение об ошибке (индекс 0) и первоисточник (индекс 1), даже если они в node_modules', () => {
    const rawStack = [
      'Error: Validation failed',
      `    at Object.validate (${FAKE_PROJECT_ROOT}/node_modules/class-validator/index.js:50:12)`,
      `    at SomeOtherFunction (${FAKE_PROJECT_ROOT}/node_modules/some-lib/index.js:10:1)`,
    ].join('\n');

    const result = cleanStackTrace(rawStack);
    const lines = result.split('\n');

    // Проверяем количество строк (третья должна быть удалена, так как это node_modules > индекс 1)
    expect(lines.length).toBe(2);
    expect(lines[0]).toBe('Error: Validation failed');
    // Индекс 1 сохранен, но путь обрезан
    expect(lines[1]).toBe('    at Object.validate (/node_modules/class-validator/index.js:50:12)');
  });

  it('должен удалять вызовы внутренних модулей Node.js (содержащие "node:")', () => {
    const rawStack = [
      'Error: Internal server error',
      `    at MyController.get (${FAKE_PROJECT_ROOT}/src/controller.ts:15:20)`,
      '    at async ServerTCP.handleMessage (node:internal/process/task_queues:103:5)',
      '    at processTicksAndRejections (node:internal/process/task_queues:95:5)',
    ].join('\n');

    const result = cleanStackTrace(rawStack);

    expect(result).not.toContain('node:internal');
    expect(result.split('\n').length).toBe(2);
    expect(result).toBe(
      ['Error: Internal server error', '    at MyController.get (/src/controller.ts:15:20)'].join(
        '\n',
      ),
    );
  });

  it('должен сохранять цепочку вызовов внутри проекта и удалять мусор', () => {
    const rawStack = [
      'TypeError: Cannot read properties of undefined',
      `    at Sharp.toBuffer (${FAKE_PROJECT_ROOT}/node_modules/sharp/output.js:163:17)`,
      `    at UploadUseCase.execute (${FAKE_PROJECT_ROOT}/src/use-cases/upload.ts:42:50)`,
      `    at CommandBus.execute (${FAKE_PROJECT_ROOT}/node_modules/@nestjs/cqrs/bus.js:81:22)`,
      `    at MediaController.upload (${FAKE_PROJECT_ROOT}/src/controllers/media.ts:25:30)`,
      '    at async processTicks (node:internal/process/task_queues:103:5)',
    ].join('\n');

    const expectedStack = [
      'TypeError: Cannot read properties of undefined',
      '    at Sharp.toBuffer (/node_modules/sharp/output.js:163:17)', // Сохранилось, так как index === 1
      '    at UploadUseCase.execute (/src/use-cases/upload.ts:42:50)', // Сохранилось, проектный файл
      // Вызов CommandBus из node_modules удален
      '    at MediaController.upload (/src/controllers/media.ts:25:30)', // Сохранилось, проектный файл
      // Вызов node:internal удален
    ].join('\n');

    expect(cleanStackTrace(rawStack)).toBe(expectedStack);
  });

  it('должен корректно заменять абсолютный путь проекта на относительный (убирать process.cwd)', () => {
    const rawStack = `Error: Path test\n    at File (${FAKE_PROJECT_ROOT}/apps/core/main.ts:10:5)`;

    const result = cleanStackTrace(rawStack);

    expect(result).not.toContain(FAKE_PROJECT_ROOT);
    expect(result).toContain('/apps/core/main.ts:10:5');
  });

  it('не должен ломаться, если стек состоит только из одной строки', () => {
    const rawStack = 'Error: Just a message without stack';
    expect(cleanStackTrace(rawStack)).toBe('Error: Just a message without stack');
  });
});
