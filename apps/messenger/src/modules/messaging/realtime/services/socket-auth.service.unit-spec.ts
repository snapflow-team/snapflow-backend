import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { LoggerFactory } from '../../../logger/logger.factory';
import { AuthTokenService } from '../../../auth/application/services/auth-token.service';
import { SocketDataType } from '../types/socket-data.type';
import { SocketAuthService } from './socket-auth.service';

describe('SocketAuthService (unit)', () => {
  const secret = 'access-token-secret';
  let service: SocketAuthService;
  let signAccessToken: (userId: number, expiresIn?: '1h' | '-1s') => string;
  let loggerWarn: jest.Mock;

  const createSocket = (options?: {
    authToken?: unknown;
    headerToken?: string | string[];
  }): Socket<any, any, any, SocketDataType> => {
    return {
      handshake: {
        auth: options && 'authToken' in options ? { token: options.authToken } : {},
        headers: options?.headerToken !== undefined ? { token: options.headerToken } : {},
      },
      data: {},
      emit: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as Socket<any, any, any, SocketDataType>;
  };

  beforeEach(() => {
    const jwtService = new JwtService({ secret });
    signAccessToken = (userId: number, expiresIn: '1h' | '-1s' = '1h') =>
      jwtService.sign({ userId }, { expiresIn });

    loggerWarn = jest.fn();
    const loggerFactoryMock = {
      create: () => ({
        warn: loggerWarn,
        log: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        trace: jest.fn(),
      }),
    } as unknown as LoggerFactory;

    service = new SocketAuthService(new AuthTokenService(jwtService), loggerFactoryMock);
  });

  describe('authorizeSocket', () => {
    it('должен отклонить подключение без token', async () => {
      const socket = createSocket();
      const next = jest.fn();

      await service.authorizeSocket(socket, next);

      expect(next).toHaveBeenCalledWith(new Error('Unauthorized: No token provided'));
      expect(socket.data.userId).toBeUndefined();
    });

    it('должен отклонить подключение с пустым token', async () => {
      const socket = createSocket({ authToken: '   ' });
      const next = jest.fn();

      await service.authorizeSocket(socket, next);

      expect(next).toHaveBeenCalledWith(new Error('Unauthorized: No token provided'));
    });

    it('должен отклонить подключение с невалидным token', async () => {
      const socket = createSocket({ authToken: 'invalid-token' });
      const next = jest.fn();

      await service.authorizeSocket(socket, next);

      expect(next).toHaveBeenCalledWith(new Error('Unauthorized: Invalid token'));
      expect(loggerWarn).toHaveBeenCalled();
    });

    it('должен отклонить подключение с истёкшим token', async () => {
      const socket = createSocket({ authToken: signAccessToken(2, '-1s') });
      const next = jest.fn();

      await service.authorizeSocket(socket, next);

      expect(next).toHaveBeenCalledWith(new Error('Unauthorized: Invalid token'));
    });

    it('должен отклонить token с невалидным userId', async () => {
      const jwtService = new JwtService({ secret });
      const socket = createSocket({
        authToken: jwtService.sign({ userId: 0 }, { expiresIn: '1h' }),
      });
      const next = jest.fn();

      await service.authorizeSocket(socket, next);

      expect(next).toHaveBeenCalledWith(new Error('Unauthorized: Invalid token'));
    });

    it('должен авторизовать сокет с валидным access token', async () => {
      const token = signAccessToken(42);
      const socket = createSocket({ authToken: token });
      const next = jest.fn();

      await service.authorizeSocket(socket, next);

      expect(next).toHaveBeenCalledWith();
      expect(socket.data.userId).toBe(42);
      expect(socket.data.exp).toEqual(expect.any(Number));
    });

    it('должен авторизовать сокет с token в формате Bearer', async () => {
      const token = `Bearer ${signAccessToken(7)}`;
      const socket = createSocket({ authToken: token });
      const next = jest.fn();

      await service.authorizeSocket(socket, next);

      expect(next).toHaveBeenCalledWith();
      expect(socket.data.userId).toBe(7);
    });

    it('должен взять token из заголовка, если auth.token отсутствует', async () => {
      const socket = createSocket({ headerToken: signAccessToken(3) });
      const next = jest.fn();

      await service.authorizeSocket(socket, next);

      expect(next).toHaveBeenCalledWith();
      expect(socket.data.userId).toBe(3);
    });

    it('должен взять первый token из массива заголовков', async () => {
      const socket = createSocket({ headerToken: [signAccessToken(5), 'ignored'] });
      const next = jest.fn();

      await service.authorizeSocket(socket, next);

      expect(next).toHaveBeenCalledWith();
      expect(socket.data.userId).toBe(5);
    });
  });

  describe('setupTokenExpiry', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('должен сразу отключить клиента без exp', () => {
      const socket = createSocket();

      service.setupTokenExpiry(socket, undefined);

      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('должен сразу отключить клиента с истёкшим exp', () => {
      const socket = createSocket();

      service.setupTokenExpiry(socket, Math.floor(Date.now() / 1000) - 10);

      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('должен отправить token.expired и отключить клиента по истечении token', () => {
      const socket = createSocket();
      const exp = Math.floor(Date.now() / 1000) + 5;

      service.setupTokenExpiry(socket, exp);

      expect(socket.disconnect).not.toHaveBeenCalled();

      jest.advanceTimersByTime(5000);

      expect(socket.emit).toHaveBeenCalledWith('token.expired');
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(socket.data.timer).toBeUndefined();
    });
  });

  describe('clearClientTimer', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('должен сбросить таймер истечения token', () => {
      const socket = createSocket();
      const exp = Math.floor(Date.now() / 1000) + 5;

      service.setupTokenExpiry(socket, exp);
      service.clearClientTimer(socket);

      jest.advanceTimersByTime(5000);

      expect(socket.emit).not.toHaveBeenCalled();
      expect(socket.disconnect).not.toHaveBeenCalled();
      expect(socket.data.timer).toBeUndefined();
    });
  });
});
