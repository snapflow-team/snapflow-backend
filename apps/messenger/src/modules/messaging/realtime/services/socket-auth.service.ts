import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { AuthTokenService } from '../../../auth/application/services/auth-token.service';
import { PayloadAccessToken } from '../../../auth/application/types/payload-access-token.type';
import { LoggerFactory } from '../../../logger/logger.factory';
import { ContextLogger } from '../../../logger/context-logger';
import { SocketDataType } from '../types/socket-data.type';

@Injectable()
export class SocketAuthService {
  private readonly logger: ContextLogger;

  constructor(
    private readonly authTokenService: AuthTokenService,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(SocketAuthService.name);
  }

  async authorizeSocket(
    socket: Socket<any, any, any, SocketDataType>,
    next: (err?: Error) => void,
  ): Promise<void> {
    try {
      const rawToken: string | undefined = this.extractToken(socket);
      if (!rawToken) {
        return next(new Error('Unauthorized: No token provided'));
      }

      const token: string | null = this.normalizeAccessToken(rawToken);
      if (!token) {
        return next(new Error('Unauthorized: Invalid token'));
      }

      const payload: PayloadAccessToken = this.authTokenService.verifyAndDecodeAccessToken(token);

      if (!Number.isInteger(payload.userId) || payload.userId <= 0) {
        throw new Error('Invalid user id from token');
      }

      socket.data.userId = payload.userId;
      socket.data.exp = payload.exp;
      next();
    } catch (error) {
      const message: string = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Socket auth failed: ${message}`);
      next(new Error('Unauthorized: Invalid token'));
    }
  }

  setupTokenExpiry(client: Socket<any, any, any, SocketDataType>, exp: number | undefined) {
    if (!exp) {
      client.disconnect(true);
      return;
    }
    const disconnectAt: number = Math.max(0, Math.floor(exp * 1000 - Date.now()));

    if (disconnectAt <= 0) {
      client.disconnect(true);
      return;
    }

    client.data.timer = setTimeout(() => {
      client.data.timer = undefined;
      client.emit('token.expired');
      client.disconnect(true);
    }, disconnectAt);
  }

  clearClientTimer(client: Socket<any, any, any, SocketDataType>) {
    if (client.data.timer) {
      clearTimeout(client.data.timer);
      client.data.timer = undefined;
    }
  }

  private extractToken(socket: Socket<any, any, any, SocketDataType>): string | undefined {
    const authToken: unknown = socket.handshake.auth?.token;
    const headerToken: string | string[] | undefined = socket.handshake.headers.token;
    const token: string | undefined =
      typeof authToken === 'string'
        ? authToken
        : typeof headerToken === 'string'
          ? headerToken
          : Array.isArray(headerToken)
            ? headerToken[0]
            : undefined;

    if (!token) {
      return undefined;
    }

    const trimmedToken: string = token.trim();
    return trimmedToken === '' ? undefined : trimmedToken;
  }

  private normalizeAccessToken(token: string): string | null {
    const trimmedToken: string = token.trim();
    if (trimmedToken === '') {
      return null;
    }

    const match = trimmedToken.match(/^Bearer\s+(\S+)$/i);

    return match?.[1] ?? trimmedToken;
  }
}
