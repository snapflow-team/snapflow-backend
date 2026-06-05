import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../setup/configuration/configuration';
import { LoggerFactory } from '../../logger/logger.factory';
import { ContextLogger } from '../../logger/context-logger';
import { AccessTokenProvider } from '../../user-accounts/auth/providers/access-token.provider';
import { Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  namespace: 'notifications',
  cors: {
    origin: '*',
  },
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;
  private readonly logger: ContextLogger;

  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    loggerFactory: LoggerFactory,
    // @Inject(AccessTokenProvider)
    // private jwtService: JwtService,
  ) {
    this.logger = loggerFactory.create(NotificationGateway.name);
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected ${client.id}`);

    // const token = client.handshake.auth.token;
    //
    // const payload = this.jwtService.verify(token);
    //
    // const userId = payload.sub;
    //
    // client.data.userId = userId;

    await client.join(`user:${1}`);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected ${client.id}`);
  }

  afterInit() {
    this.logger.log('Websocket gateway successfully started');
  }
}
