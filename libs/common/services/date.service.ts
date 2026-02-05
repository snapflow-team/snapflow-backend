import { Injectable } from '@nestjs/common';
import { add, isBefore, Duration } from 'date-fns';

@Injectable()
export class DateService {
  now(): Date {
    return new Date();
  }

  generateExpirationDate(expirationOffset: Duration, fromDate: Date = this.now()): Date {
    return add(fromDate, expirationOffset);
  }

  isExpired(expirationDate: Date, referenceDate: Date = this.now()): boolean {
    return isBefore(expirationDate, referenceDate);
  }
}
