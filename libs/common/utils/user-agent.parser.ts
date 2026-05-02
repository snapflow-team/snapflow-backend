import { UAParser } from 'ua-parser-js';

export type ParsedUserAgentDetails = {
  browserName: string;
  browserVersion: string;
  osName: string;
  osVersion: string;
  deviceName: string;
  deviceType: string;
};

/**
 * Разбирает строку User-Agent и возвращает нормализованные поля браузера, ОС и устройства.
 *
 * Используйте этот helper, когда нужны стабильные данные сессии для сохранения в БД
 * и отдачи в API. Функция всегда возвращает строки и не допускает `null`,
 * подставляя fallback-значения для неполного или неизвестного User-Agent.
 *
 * Правила fallback:
 * - `browserName`: `'Unknown browser'`
 * - `browserVersion`: `''`
 * - `osName`: `'Unknown OS'`
 * - `osVersion`: `''`
 * - `deviceName`: `device.model`, если есть; иначе `browserName`
 * - `deviceType`: `device.type`, если есть; иначе `'desktop'`
 *
 * @param userAgent Значение заголовка `User-Agent` из HTTP-запроса.
 * @returns Нормализованный объект вида:
 * `{ browserName, browserVersion, osName, osVersion, deviceName, deviceType }`
 *
 * @example
 * parseUserAgentDetails(
 *   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
 * );
 * // {
 * //   browserName: 'Chrome',
 * //   browserVersion: '124.0.0.0',
 * //   osName: 'Windows',
 * //   osVersion: '10',
 * //   deviceName: 'Chrome',
 * //   deviceType: 'desktop'
 * // }
 *
 * @example
 * parseUserAgentDetails('');
 * // {
 * //   browserName: 'Unknown browser',
 * //   browserVersion: '',
 * //   osName: 'Unknown OS',
 * //   osVersion: '',
 * //   deviceName: 'Unknown browser',
 * //   deviceType: 'desktop'
 * // }
 */
export function parseUserAgentDetails(userAgent: string): ParsedUserAgentDetails {
  const parser = new UAParser(userAgent);
  const browser = parser.getBrowser();
  const os = parser.getOS();
  const device = parser.getDevice();

  const browserName = browser.name ?? 'Unknown browser';
  const browserVersion = browser.version ?? '';
  const osName = os.name ?? 'Unknown OS';
  const osVersion = os.version ?? '';

  return {
    browserName,
    browserVersion,
    osName,
    osVersion,
    deviceName: device.model ?? browserName,
    deviceType: device.type ?? 'desktop',
  };
}
