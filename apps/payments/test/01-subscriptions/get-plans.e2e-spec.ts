import { Server } from 'http';
import request, { Response } from 'supertest';
import { GLOBAL_PREFIX } from '../../../../libs/common/constants/global-prefix.constant';
import { HttpStatus } from '@nestjs/common';
import { PlanViewDto } from '../../src/modules/subscriptions/api/view-dto/plan.view-dto';
import { AppTestManager } from '../managers/app.test-manager';

describe('SubscriptionsController - getPlans() (GET: /subscriptions/plans)', () => {
  let appTestManager: AppTestManager;
  let server: Server;

  beforeAll(async () => {
    appTestManager = new AppTestManager();
    await appTestManager.init();

    server = appTestManager.getServer();
  });

  beforeEach(async () => {
    await appTestManager.cleanupDb(['_prisma_migrations']);
  });

  afterAll(async () => {
    await appTestManager.close();
  });

  it('должен вернуть список планов подписки с корректной структурой и статусом 200', async () => {
    // 🔻 Отправляем GET-запрос на /subscriptions/plans
    const res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/subscriptions/plans`)
      .expect(HttpStatus.OK);

    // 🔸 Проверяем, что ответ является массивом
    expect(Array.isArray(res.body)).toBe(true);

    // 🔸 Проверяем, что каждый элемент соответствует структуре PlanViewDto
    for (const plan of res.body as PlanViewDto[]) {
      expect(plan).toEqual<PlanViewDto>({
        id: expect.any(String),
        label: expect.any(String),
        priceInCents: expect.any(Number),
      });
    }
  });

  it('должен вернуть ровно 2 плана подписки', async () => {
    // 🔻 Отправляем GET-запрос на /subscriptions/plans
    const res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/subscriptions/plans`)
      .expect(HttpStatus.OK);

    // 🔸 Проверяем, что в ответе ровно 2 плана
    expect((res.body as PlanViewDto[]).length).toBe(2);
  });

  it('должен вернуть план "business_monthly" с корректными данными', async () => {
    // 🔻 Отправляем GET-запрос на /subscriptions/plans
    const res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/subscriptions/plans`)
      .expect(HttpStatus.OK);

    const plans = res.body as PlanViewDto[];

    // 🔸 Находим план business_monthly и проверяем его поля
    const monthlyPlan: PlanViewDto | undefined = plans.find((p) => p.id === 'business_monthly');

    expect(monthlyPlan).toBeDefined();
    expect(monthlyPlan).toEqual<PlanViewDto>({
      id: 'business_monthly',
      label: 'Business Monthly',
      priceInCents: 1000,
    });
  });

  it('должен вернуть план "business_yearly" с корректными данными', async () => {
    // 🔻 Отправляем GET-запрос на /subscriptions/plans
    const res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/subscriptions/plans`)
      .expect(HttpStatus.OK);

    const plans = res.body as PlanViewDto[];

    // 🔸 Находим план business_yearly и проверяем его поля
    const yearlyPlan: PlanViewDto | undefined = plans.find((p) => p.id === 'business_yearly');

    expect(yearlyPlan).toBeDefined();
    expect(yearlyPlan).toEqual<PlanViewDto>({
      id: 'business_yearly',
      label: 'Business Yearly',
      priceInCents: 9000,
    });
  });

  it('не должен содержать поле stripePriceId в ответе (внутреннее поле не должно утекать в API)', async () => {
    // 🔻 Отправляем GET-запрос на /subscriptions/plans
    const res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/subscriptions/plans`)
      .expect(HttpStatus.OK);

    const plans = res.body as PlanViewDto[];

    // 🔸 Убеждаемся, что stripePriceId не присутствует ни в одном плане
    for (const plan of plans) {
      expect(plan).not.toHaveProperty('stripePriceId');
    }
  });

  it('должен вернуть планы в правильном порядке: сначала monthly, затем yearly', async () => {
    // 🔻 Отправляем GET-запрос на /subscriptions/plans
    const res: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/subscriptions/plans`)
      .expect(HttpStatus.OK);

    const plans = res.body as PlanViewDto[];

    // 🔸 Проверяем порядок планов
    expect(plans[0].id).toBe('business_monthly');
    expect(plans[1].id).toBe('business_yearly');
  });

  it('должен корректно возвращать планы при повторных запросах (идемпотентность)', async () => {
    // 🔻 Отправляем два последовательных GET-запроса
    const res1: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/subscriptions/plans`)
      .expect(HttpStatus.OK);

    const res2: Response = await request(server)
      .get(`/${GLOBAL_PREFIX}/subscriptions/plans`)
      .expect(HttpStatus.OK);

    // 🔸 Ответы должны быть идентичны
    expect(res1.body).toEqual(res2.body);
  });
});
