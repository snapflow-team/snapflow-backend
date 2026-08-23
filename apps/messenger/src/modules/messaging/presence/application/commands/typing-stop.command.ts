import { TypingApplicationDto } from '../dto/typing.application-dto';

export class TypingStopCommand {
  constructor(public readonly dto: TypingApplicationDto) {}
}
