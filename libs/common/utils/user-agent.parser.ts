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
 * Разбирает строку User-Agent и возвращает детальные поля устройства/браузера/ОС.
 * Для неполных или неизвестных значений применяются fallback-значения.
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
