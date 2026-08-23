import { TypingApplicationDto } from '../dto/typing.application-dto';

export class TypingStartCommand {
  constructor(public readonly dto: TypingApplicationDto) {}
}
