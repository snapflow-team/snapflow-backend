import { IBrowser, UAParser } from 'ua-parser-js';

/**
 * Разбирает строку User-Agent и возвращает человекочитаемую информацию о браузере и операционной системе.
 *
 * @param {string} userAgent - Строка User-Agent из HTTP-заголовка запроса.
 * @returns {string} Информация о браузере и операционной системе в формате:
 *                   "<Название браузера> <Версия браузера> on <Название ОС>"
 *                   Если информация недоступна, возвращается "Unknown browser on Unknown OS".
 *
 * @example
 * parseUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/113.0.5672.126 Safari/537.36");
 * // => "Chrome 113.0.5672.126 on Windows"
 *
 * @example
 * parseUserAgent("");
 * // => "Unknown browser on Unknown OS"
 */
export function parseUserAgent(userAgent: string): string {
  const parser = new UAParser(userAgent);
  const browser: IBrowser = parser.getBrowser();
  const os = parser.getOS();

  const browserInfo: string =
    browser.name && browser.version ? `${browser.name} ${browser.version}` : 'Unknown browser';

  const osInfo: string = os.name ? os.name : 'Unknown OS';

  return `${browserInfo} on ${osInfo}`;
}
