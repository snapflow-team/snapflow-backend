import {
  RegistrationUserInputDto
} from '../../src/modules/user-accounts/auth/api/input-dto/registration-user.input-dto';

export class TestDtoFactory {
  static generateRegistrationUserInputDto(quantity: number): RegistrationUserInputDto[] {
    const dtos: RegistrationUserInputDto[] = [];

    for (let i = 0; i < quantity; i++) {
      dtos.push({
        username: `test_user${i}`,
        email: `test_user${i}@example.com`,

        password: 'Qwerty_1',
      });
    }

    return dtos;
  }
}
