import { UpdateActivityStatusApplicationDto } from '../dto/update-activity-status.application-dto';

export class UpdateActivityStatusCommand {
  constructor(public readonly dto: UpdateActivityStatusApplicationDto) {}
}
