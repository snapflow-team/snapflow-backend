import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { GLOBAL_PREFIX } from '../../../../../../../libs/common/constants/global-prefix.constant';
import {
  GetInternalPaymentsQueryParams,
  InternalPaymentsPaginatedResponse,
} from '../../../../../../../libs/contracts/payments/constants/internal-payments-api.contract';
import {
  INTERNAL_API_SECRET_HEADER,
  INTERNAL_PAYMENTS_API_PATH,
} from '../../../../../../../libs/contracts/payments/constants/internal-api.constants';
import { Configuration } from '../../../../setup/configuration/configuration';
import { AdminSettings } from '../../../../setup/configuration/admin-settings';

@Injectable()
export class AdminPaymentsHttpClient {
  private readonly adminSettings: AdminSettings;

  constructor(
    private readonly httpService: HttpService,
    configService: ConfigService<Configuration, true>,
  ) {
    this.adminSettings = configService.get<AdminSettings>('adminSettings');
  }

  async getPayments(
    params: GetInternalPaymentsQueryParams,
  ): Promise<InternalPaymentsPaginatedResponse> {
    const baseUrl: string = this.adminSettings.paymentsServiceUrl.replace(/\/$/, '');
    const url = `${baseUrl}/${GLOBAL_PREFIX}/${INTERNAL_PAYMENTS_API_PATH}`;

    const response = await firstValueFrom(
      this.httpService.get<InternalPaymentsPaginatedResponse>(url, {
        headers: {
          [INTERNAL_API_SECRET_HEADER]: this.adminSettings.internalApiSecret,
        },
        params: {
          page: params.page,
          pageSize: params.pageSize,
          sortBy: params.sortBy,
          sortDirection: params.sortDirection,
          ...(params.userIds?.length ? { userIds: params.userIds.join(',') } : {}),
        },
      }),
    );

    return response.data;
  }
}
