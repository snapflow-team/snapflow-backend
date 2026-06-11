import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../../setup/configuration/configuration';
import { AdminSettings } from '../../../../setup/configuration/admin-settings';
import { UnauthorizedException } from '../../../../common/exceptions/domain-exceptions';
import { CryptoService } from '../../../../../../../libs/common/services/crypto.service';
import { DateService } from '../../../../../../../libs/common/services/date.service';
import { parseUserAgentDetails } from '../../../../../../../libs/common/utils/user-agent.parser';
import { AdminSessionsRepository } from '../../infrastructure/repositories/admin-sessions.repository';
import { LoginAdminApplicationDto } from '../dto/login-admin-application.dto';
import { AdminLoginResult } from '../types/admin-login-result.type';
import { Prisma } from '@generated/prisma-snapflow';

export class AdminLoginCommand {
  constructor(public readonly dto: LoginAdminApplicationDto) {}
}

@CommandHandler(AdminLoginCommand)
export class AdminLoginUseCase implements ICommandHandler<AdminLoginCommand> {
  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    private readonly cryptoService: CryptoService,
    private readonly dateService: DateService,
    private readonly adminSessionsRepository: AdminSessionsRepository,
  ) {}

  async execute({
    dto: { email, password, ip, userAgent },
  }: AdminLoginCommand): Promise<AdminLoginResult> {
    const adminSettings: AdminSettings = this.configService.get<AdminSettings>('adminSettings');

    if (email !== adminSettings.email || password !== adminSettings.password) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    await this.adminSessionsRepository.softDeleteAllActive();

    const sessionId: string = this.cryptoService.generateUUID();
    const expiresAt: Date = this.dateService.generateExpirationDate({
      hours: adminSettings.sessionMaxAgeHours,
    });
    const { browserName, browserVersion, osName, osVersion, deviceName, deviceType } =
      parseUserAgentDetails(userAgent);

    const sessionData: Prisma.AdminSessionCreateInput = {
      id: sessionId,
      deviceName,
      browserName,
      browserVersion,
      osName,
      osVersion,
      deviceType,
      ip,
      expiresAt,
    };

    await this.adminSessionsRepository.create(sessionData);

    return { sessionId };
  }
}
