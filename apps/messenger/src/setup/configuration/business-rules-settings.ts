import { EnvironmentVariable } from './configuration';

export class BusinessRulesSettings {
  constructor(private readonly environmentVariables: EnvironmentVariable) {}
}
