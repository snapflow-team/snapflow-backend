import { Injectable } from '@nestjs/common';
import { add, differenceInYears, Duration, getUnixTime, isBefore, subDays } from 'date-fns';

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

  getAge(dob: Date): number {
    return differenceInYears(this.now(), dob);
  }

  addDaysToDate(date: Date, days: number): Date {
    return add(date, { days });
  }

  convertDateToSeconds(date: Date): number {
    //Возвращает из даты количество секунд от 1970 года
    return getUnixTime(date);
  }
  getDelayForJob(expirationDate: string, daysBeforeExpiration: number): number {
    const scheduleDate = subDays(new Date(expirationDate), daysBeforeExpiration);

    return Math.max(0, scheduleDate.getTime() - Date.now());
  }
}
