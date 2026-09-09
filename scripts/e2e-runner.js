const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { ResponseInterceptor } = require('../dist/common/interceptors/response.interceptor');
const { HttpExceptionFilter } = require('../dist/common/filters/http-exception.filter');
const { ValidationPipe } = require('@nestjs/common');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const fs = require('fs');

async function runAudit() {
  console.log('🚀 Initializing NestJS App in memory for E2E Audit...');
  const app = await NestFactory.create(AppModule, { logger: false });

  app.use(cookieParser());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();
  const server = app.getHttpServer();

  const results = [];
  const createdResources = {
    userEmail: 'slava+e2e1@example.com',
    userPassword: process.env.TEST_USER_PASSWORD || 'Password123!',
    userAccessToken: '',
    userRefreshTokenCookie: '',
    adminEmail: process.env.ADMIN_EMAIL || '',
    adminPassword: process.env.ADMIN_PASSWORD || '',
    adminAccessToken: '',
    adminRefreshTokenCookie: '',
    createdEventId: '',
    createdBookingId: '',
  };

  // Step 1: Capture initial GET /events
  console.log('\n--- Step 1: GET /events (Before) ---');
  const resInitialEvents = await request(server).get('/events');
  const initialEventsState = JSON.stringify(resInitialEvents.body);
  console.log('Initial events response status:', resInitialEvents.status);

  // 1. GET /
  console.log('Testing 1/25: GET /');
  const r1 = await request(server).get('/');
  results.push({
    num: 1, category: 'Служебное', method: 'GET', path: '/',
    note: 'Главная страница', expectedStatus: '200 OK',
    actualStatus: r1.status, requestBody: null, responseBody: r1.body,
    matched: r1.status === 200
  });

  // 2. GET /health
  console.log('Testing 2/25: GET /health');
  const r2 = await request(server).get('/health');
  results.push({
    num: 2, category: 'Служебное', method: 'GET', path: '/health',
    note: 'Проверка здоровья', expectedStatus: '200 OK',
    actualStatus: r2.status, requestBody: null, responseBody: r2.body,
    matched: r2.status === 200
  });

  // 3. POST /auth/register
  console.log('Testing 3/25: POST /auth/register');
  const regBody = { email: createdResources.userEmail, password: createdResources.userPassword, name: 'Slava E2E' };
  const r3 = await request(server).post('/auth/register').send(regBody);
  if (r3.status === 201 || r3.status === 200) {
    createdResources.userAccessToken = r3.body?.data?.access_token || r3.body?.access_token || '';
    const cookies = r3.get('Set-Cookie');
    if (cookies) createdResources.userRefreshTokenCookie = cookies.find((c) => c.startsWith('refresh_token')) || '';
  }
  results.push({
    num: 3, category: 'Авторизация пользователя', method: 'POST', path: '/auth/register',
    note: 'Регистрация пользователя', expectedStatus: '201/200 OK',
    actualStatus: r3.status, requestBody: regBody, responseBody: r3.body,
    matched: r3.status === 201 || r3.status === 200
  });

  // 4. POST /auth/login
  console.log('Testing 4/25: POST /auth/login');
  const loginBody = { email: createdResources.userEmail, password: createdResources.userPassword };
  const r4 = await request(server).post('/auth/login').send(loginBody);
  if (r4.status === 200) {
    createdResources.userAccessToken = r4.body?.data?.access_token || r4.body?.access_token || createdResources.userAccessToken;
    const cookies = r4.get('Set-Cookie');
    if (cookies) {
      const rf = cookies.find((c) => c.startsWith('refresh_token'));
      if (rf) createdResources.userRefreshTokenCookie = rf;
    }
  }
  results.push({
    num: 4, category: 'Авторизация пользователя', method: 'POST', path: '/auth/login',
    note: 'Логин пользователя', expectedStatus: '200 OK',
    actualStatus: r4.status, requestBody: loginBody, responseBody: r4.body,
    matched: r4.status === 200
  });

  // 5. POST /auth/google
  console.log('Testing 5/25: POST /auth/google');
  const googleBody = { idToken: 'fake-google-token-123' };
  const r5 = await request(server).post('/auth/google').send(googleBody);
  results.push({
    num: 5, category: 'Авторизация пользователя', method: 'POST', path: '/auth/google',
    note: 'Гугл авторизация (невалидный токен)', expectedStatus: '400/401',
    actualStatus: r5.status, requestBody: googleBody, responseBody: r5.body,
    matched: r5.status === 400 || r5.status === 401
  });

  // 6. POST /auth/refresh
  console.log('Testing 6/25: POST /auth/refresh');
  const req6 = request(server).post('/auth/refresh');
  if (createdResources.userRefreshTokenCookie) {
    req6.set('Cookie', [createdResources.userRefreshTokenCookie]);
  }
  const r6_1 = await req6;
  // Try same token twice
  const req6_2 = request(server).post('/auth/refresh');
  if (createdResources.userRefreshTokenCookie) {
    req6_2.set('Cookie', [createdResources.userRefreshTokenCookie]);
  }
  const r6_2 = await req6_2;
  results.push({
    num: 6, category: 'Авторизация пользователя', method: 'POST', path: '/auth/refresh',
    note: 'Рефреш токена (1-й: ' + r6_1.status + ', 2-й повторно: ' + r6_2.status + ')',
    expectedStatus: '1-й 200, 2-й 401/400/500',
    actualStatus: r6_1.status, requestBody: null,
    responseBody: { attempt1: { status: r6_1.status, body: r6_1.body }, attempt2: { status: r6_2.status, body: r6_2.body } },
    matched: r6_1.status === 200 && (r6_2.status === 401 || r6_2.status === 400 || r6_2.status === 500)
  });

  // 7. POST /auth/logout
  console.log('Testing 7/25: POST /auth/logout');
  const req7 = request(server).post('/auth/logout');
  if (createdResources.userRefreshTokenCookie) {
    req7.set('Cookie', [createdResources.userRefreshTokenCookie]);
  }
  const r7 = await req7;
  results.push({
    num: 7, category: 'Авторизация пользователя', method: 'POST', path: '/auth/logout',
    note: 'Выход пользователя', expectedStatus: '200 OK',
    actualStatus: r7.status, requestBody: null, responseBody: r7.body,
    matched: r7.status === 200
  });

  // 8. POST /auth/send-password-reset
  console.log('Testing 8/25: POST /auth/send-password-reset');
  const resetBody = { email: createdResources.userEmail };
  const r8 = await request(server).post('/auth/send-password-reset').send(resetBody);
  results.push({
    num: 8, category: 'Авторизация пользователя', method: 'POST', path: '/auth/send-password-reset',
    note: 'Сброс пароля', expectedStatus: '200 OK',
    actualStatus: r8.status, requestBody: resetBody, responseBody: r8.body,
    matched: r8.status === 200
  });

  // Re-login user to get fresh access token for 9-12
  const r4_re = await request(server).post('/auth/login').send(loginBody);
  if (r4_re.status === 200) {
    createdResources.userAccessToken = r4_re.body?.data?.access_token || r4_re.body?.access_token || createdResources.userAccessToken;
  }

  // 9. POST /auth/change-password (🔒 юзер)
  console.log('Testing 9/25: POST /auth/change-password');
  const r9_noAuth = await request(server).post('/auth/change-password').send({ currentPassword: 'Password123!', newPassword: 'Password123!' });
  const r9_auth = await request(server).post('/auth/change-password')
    .set('Authorization', `Bearer ${createdResources.userAccessToken}`)
    .send({ currentPassword: 'Password123!', newPassword: 'Password123!' });
  results.push({
    num: 9, category: 'Авторизация пользователя', method: 'POST', path: '/auth/change-password (🔒)',
    note: 'Смена пароля (без токена: ' + r9_noAuth.status + ', с токеном: ' + r9_auth.status + ')',
    expectedStatus: 'без токена: 401, с токеном: 200',
    actualStatus: r9_auth.status, requestBody: { currentPassword: '***', newPassword: '***' },
    responseBody: { noAuth: { status: r9_noAuth.status, body: r9_noAuth.body }, auth: { status: r9_auth.status, body: r9_auth.body } },
    matched: r9_noAuth.status === 401 && r9_auth.status === 200
  });

  // 10. POST /auth/profile (🔒 юзер)
  console.log('Testing 10/25: POST /auth/profile');
  const r10_noAuth = await request(server).post('/auth/profile').send({ nickname: 'Slava Updated' });
  const r10_auth = await request(server).post('/auth/profile')
    .set('Authorization', `Bearer ${createdResources.userAccessToken}`)
    .send({ nickname: 'Slava Updated' });
  results.push({
    num: 10, category: 'Авторизация пользователя', method: 'POST', path: '/auth/profile (🔒)',
    note: 'Обновление профиля (без токена: ' + r10_noAuth.status + ', с токеном: ' + r10_auth.status + ')',
    expectedStatus: 'без токена: 401, с токеном: 200',
    actualStatus: r10_auth.status, requestBody: { nickname: 'Slava Updated' },
    responseBody: { noAuth: { status: r10_noAuth.status, body: r10_noAuth.body }, auth: { status: r10_auth.status, body: r10_auth.body } },
    matched: r10_noAuth.status === 401 && r10_auth.status === 200
  });

  // 11. GET /auth/debug/token-info (🔒 юзер)
  console.log('Testing 11/25: GET /auth/debug/token-info');
  const r11_noAuth = await request(server).get('/auth/debug/token-info');
  const r11_auth = await request(server).get('/auth/debug/token-info')
    .set('Authorization', `Bearer ${createdResources.userAccessToken}`);
  results.push({
    num: 11, category: 'Авторизация пользователя', method: 'GET', path: '/auth/debug/token-info (🔒)',
    note: 'Debug эндпоинт токена (без токена: ' + r11_noAuth.status + ', с токеном: ' + r11_auth.status + ')',
    expectedStatus: 'без токена: 401, с токеном: 200',
    actualStatus: r11_auth.status, requestBody: null,
    responseBody: { noAuth: { status: r11_noAuth.status, body: r11_noAuth.body }, auth: { status: r11_auth.status, body: r11_auth.body } },
    matched: r11_noAuth.status === 401 && r11_auth.status === 200
  });

  // 12. GET /protected/profile (🔒 юзер)
  console.log('Testing 12/25: GET /protected/profile');
  const r12_noAuth = await request(server).get('/protected/profile');
  const r12_auth = await request(server).get('/protected/profile')
    .set('Authorization', `Bearer ${createdResources.userAccessToken}`);
  results.push({
    num: 12, category: 'Защищенные роуты', method: 'GET', path: '/protected/profile (🔒)',
    note: 'Профиль (без токена: ' + r12_noAuth.status + ', с токеном: ' + r12_auth.status + ')',
    expectedStatus: 'без токена: 401, с токеном: 200',
    actualStatus: r12_auth.status, requestBody: null,
    responseBody: { noAuth: { status: r12_noAuth.status, body: r12_noAuth.body }, auth: { status: r12_auth.status, body: r12_auth.body } },
    matched: r12_noAuth.status === 401 && r12_auth.status === 200
  });

  // 13. GET /events
  console.log('Testing 13/25: GET /events');
  const r13 = await request(server).get('/events?page=1&limit=10');
  const eventsList = r13.body?.data?.events || r13.body?.data || [];
  let firstEventId = eventsList[0]?.id;
  results.push({
    num: 13, category: 'Публичные ивенты', method: 'GET', path: '/events',
    note: 'Список ивентов с пагинацией', expectedStatus: '200 OK',
    actualStatus: r13.status, requestBody: null, responseBody: r13.body,
    matched: r13.status === 200
  });

  // 14. GET /events/:id
  console.log('Testing 14/25: GET /events/:id');
  const testEventId = firstEventId || 'non-existent-uuid-12345';
  const r14_valid = await request(server).get(`/events/${testEventId}`);
  const r14_invalid = await request(server).get('/events/non-existent-id-99999');
  results.push({
    num: 14, category: 'Публичные ивенты', method: 'GET', path: '/events/:id',
    note: 'Детали ивента (существующий: ' + r14_valid.status + ', несуществующий: ' + r14_invalid.status + ')',
    expectedStatus: 'существующий: 200, несуществующий: 404',
    actualStatus: r14_invalid.status, requestBody: null,
    responseBody: { validId: { status: r14_valid.status, body: r14_valid.body }, invalidId: { status: r14_invalid.status, body: r14_invalid.body } },
    matched: r14_valid.status === 200 && r14_invalid.status === 404
  });

  // 15. POST /events/:id/book
  console.log('Testing 15/25: POST /events/:id/book');
  const r15_over = await request(server).post(`/events/${testEventId}/book`).send({ name: 'Over', email: 'over@test.com', participant_count: 99999 });
  const r15_zero = await request(server).post(`/events/${testEventId}/book`).send({ name: 'Zero', email: 'zero@test.com', participant_count: 0 });
  const r15_neg = await request(server).post(`/events/${testEventId}/book`).send({ name: 'Neg', email: 'neg@test.com', participant_count: -1 });
  const r15_normal = await request(server).post(`/events/${testEventId}/book`).send({ name: 'Normal', email: 'normal@test.com', participant_count: 1 });
  if (r15_normal.status === 201 || r15_normal.status === 200) {
    createdResources.createdBookingId = r15_normal.body?.data?.id || r15_normal.body?.id;
  }
  results.push({
    num: 15, category: 'Публичные ивенты', method: 'POST', path: '/events/:id/book',
    note: 'Бронирование (сверх: ' + r15_over.status + ', 0: ' + r15_zero.status + ', -1: ' + r15_neg.status + ', 1: ' + r15_normal.status + ')',
    expectedStatus: 'over: 400/409, 0: 400, neg: 400, 1: 201/200',
    actualStatus: r15_normal.status, requestBody: { participant_counts: [99999, 0, -1, 1] },
    responseBody: { over: { status: r15_over.status, body: r15_over.body }, zero: { status: r15_zero.status, body: r15_zero.body }, neg: { status: r15_neg.status, body: r15_neg.body }, normal: { status: r15_normal.status, body: r15_normal.body } },
    matched: r15_zero.status === 400 && r15_neg.status === 400
  });

  // 16. GET /events/:id/bookings
  console.log('Testing 16/25: GET /events/:id/bookings');
  const r16 = await request(server).get(`/events/${testEventId}/bookings`);
  results.push({
    num: 16, category: 'Публичные ивенты', method: 'GET', path: '/events/:id/bookings',
    note: 'Список броней ивента', expectedStatus: '200 OK',
    actualStatus: r16.status, requestBody: null, responseBody: r16.body,
    matched: r16.status === 200
  });

  // 17. POST /admin/auth/login
  console.log('Testing 17/25: POST /admin/auth/login');
  const adminLoginBody = { email: createdResources.adminEmail, password: createdResources.adminPassword };
  const r17 = await request(server).post('/admin/auth/login').send(adminLoginBody);
  if (r17.status === 200) {
    createdResources.adminAccessToken = r17.body?.data?.access_token || r17.body?.access_token || '';
    const cookies = r17.get('Set-Cookie');
    if (cookies) {
      const arf = cookies.find((c) => c.startsWith('admin_refresh_token'));
      if (arf) createdResources.adminRefreshTokenCookie = arf;
    }
  }
  results.push({
    num: 17, category: 'Авторизация админа', method: 'POST', path: '/admin/auth/login',
    note: 'Логин админа', expectedStatus: '200 OK',
    actualStatus: r17.status, requestBody: adminLoginBody, responseBody: r17.body,
    matched: r17.status === 200
  });

  // 18. POST /admin/auth/refresh
  console.log('Testing 18/25: POST /admin/auth/refresh');
  const req18 = request(server).post('/admin/auth/refresh');
  if (createdResources.adminRefreshTokenCookie) {
    req18.set('Cookie', [createdResources.adminRefreshTokenCookie]);
  }
  const r18 = await req18;
  results.push({
    num: 18, category: 'Авторизация админа', method: 'POST', path: '/admin/auth/refresh',
    note: 'Рефреш токена админа', expectedStatus: '200 OK',
    actualStatus: r18.status, requestBody: null, responseBody: r18.body,
    matched: r18.status === 200
  });

  // 19. POST /admin/auth/logout (🔒 админ)
  console.log('Testing 19/25: POST /admin/auth/logout');
  const r19_noAuth = await request(server).post('/admin/auth/logout');
  const req19_auth = request(server).post('/admin/auth/logout')
    .set('Authorization', `Bearer ${createdResources.adminAccessToken}`);
  if (createdResources.adminRefreshTokenCookie) {
    req19_auth.set('Cookie', [createdResources.adminRefreshTokenCookie]);
  }
  const r19_auth = await req19_auth;
  results.push({
    num: 19, category: 'Авторизация админа', method: 'POST', path: '/admin/auth/logout (🔒)',
    note: 'Выход админа (без токена: ' + r19_noAuth.status + ', с токеном: ' + r19_auth.status + ')',
    expectedStatus: 'без токена: 401, с токеном: 200',
    actualStatus: r19_auth.status, requestBody: null,
    responseBody: { noAuth: { status: r19_noAuth.status, body: r19_noAuth.body }, auth: { status: r19_auth.status, body: r19_auth.body } },
    matched: r19_noAuth.status === 401 && r19_auth.status === 200
  });

  // Re-login admin for admin actions 20-25
  const r17_re = await request(server).post('/admin/auth/login').send(adminLoginBody);
  if (r17_re.status === 200) {
    createdResources.adminAccessToken = r17_re.body?.data?.access_token || r17_re.body?.access_token || createdResources.adminAccessToken;
  }

  // 20. GET /admin/events (🔒 админ)
  console.log('Testing 20/25: GET /admin/events');
  const r20_noAuth = await request(server).get('/admin/events');
  const r20_auth = await request(server).get('/admin/events')
    .set('Authorization', `Bearer ${createdResources.adminAccessToken}`);
  results.push({
    num: 20, category: 'Админские ивенты', method: 'GET', path: '/admin/events (🔒)',
    note: 'Список ивентов для админа (без токена: ' + r20_noAuth.status + ', с токеном: ' + r20_auth.status + ')',
    expectedStatus: 'без токена: 401, с токеном: 200',
    actualStatus: r20_auth.status, requestBody: null,
    responseBody: { noAuth: { status: r20_noAuth.status, body: r20_noAuth.body }, auth: { status: r20_auth.status, body: r20_auth.body } },
    matched: r20_noAuth.status === 401 && r20_auth.status === 200
  });

  // 21. POST /admin/events (🔒 админ)
  console.log('Testing 21/25: POST /admin/events');
  const r21_noAuth = await request(server).post('/admin/events').send({ title: 'Test E2E Event' });
  const r21_badBody = await request(server).post('/admin/events')
    .set('Authorization', `Bearer ${createdResources.adminAccessToken}`)
    .send({ title: '' });
  const createEventBody = {
    title: 'E2E Test Event Slava',
    description: 'Temporary E2E event created during audit',
    category: 'TECH',
    price: 0,
    date: '2026-10-01',
    start_time: '18:00',
    duration_minutes: 120,
    capacity: 50,
    location: 'Online',
  };
  const r21_goodBody = await request(server).post('/admin/events')
    .set('Authorization', `Bearer ${createdResources.adminAccessToken}`)
    .send(createEventBody);
  if (r21_goodBody.status === 201 || r21_goodBody.status === 200) {
    createdResources.createdEventId = r21_goodBody.body?.data?.id || r21_goodBody.body?.id || '';
  }
  results.push({
    num: 21, category: 'Админские ивенты', method: 'POST', path: '/admin/events (🔒)',
    note: 'Создание ивента (без токена: ' + r21_noAuth.status + ', с кривым телом: ' + r21_badBody.status + ', с токеном: ' + r21_goodBody.status + ')',
    expectedStatus: 'без токена: 401, кривое тело: 400, с токеном: 201',
    actualStatus: r21_goodBody.status, requestBody: createEventBody,
    responseBody: { noAuth: { status: r21_noAuth.status, body: r21_noAuth.body }, badBody: { status: r21_badBody.status, body: r21_badBody.body }, goodBody: { status: r21_goodBody.status, body: r21_goodBody.body } },
    matched: r21_noAuth.status === 401 && r21_badBody.status === 400 && (r21_goodBody.status === 201 || r21_goodBody.status === 200)
  });

  if (!createdResources.createdEventId) {
    console.log('⚠️ Skipping steps 22-25: No test event was created on step 21 (createdEventId is empty). Refusing to mutate existing events.');
  } else {
    const eventIdToModify = createdResources.createdEventId;

    // 22. PUT /admin/events/:id (🔒 админ)
    console.log('Testing 22/25: PUT /admin/events/:id');
    const updateEventBody = {
      title: 'E2E Test Event Slava Updated',
      description: 'Updated description',
      category: 'WORKSHOP',
      price: 10,
      date: '2026-10-02',
      start_time: '19:00',
      duration_minutes: 90,
      capacity: 100,
      location: 'Updated Online',
    };
    const r22_noAuth = await request(server).put(`/admin/events/${eventIdToModify}`).send(updateEventBody);
    const r22_auth = await request(server).put(`/admin/events/${eventIdToModify}`)
      .set('Authorization', `Bearer ${createdResources.adminAccessToken}`)
      .send(updateEventBody);
    results.push({
      num: 22, category: 'Админские ивенты', method: 'PUT', path: '/admin/events/:id (🔒)',
      note: 'Обновление ивента (без токена: ' + r22_noAuth.status + ', с токеном: ' + r22_auth.status + ')',
      expectedStatus: 'без токена: 401, с токеном: 200',
      actualStatus: r22_auth.status, requestBody: updateEventBody,
      responseBody: { noAuth: { status: r22_noAuth.status, body: r22_noAuth.body }, auth: { status: r22_auth.status, body: r22_auth.body } },
      matched: r22_noAuth.status === 401 && r22_auth.status === 200
    });

    // 23. PATCH /admin/events/:id/status (🔒 админ)
    console.log('Testing 23/25: PATCH /admin/events/:id/status');
    const patchStatusBody = { status: 'PUBLISHED' };
    const r23_noAuth = await request(server).patch(`/admin/events/${eventIdToModify}/status`).send(patchStatusBody);
    const r23_auth = await request(server).patch(`/admin/events/${eventIdToModify}/status`)
      .set('Authorization', `Bearer ${createdResources.adminAccessToken}`)
      .send(patchStatusBody);
    results.push({
      num: 23, category: 'Админские ивенты', method: 'PATCH', path: '/admin/events/:id/status (🔒)',
      note: 'Изменение статуса (без токена: ' + r23_noAuth.status + ', с токеном: ' + r23_auth.status + ')',
      expectedStatus: 'без токена: 401, с токеном: 200',
      actualStatus: r23_auth.status, requestBody: patchStatusBody,
      responseBody: { noAuth: { status: r23_noAuth.status, body: r23_noAuth.body }, auth: { status: r23_auth.status, body: r23_auth.body } },
      matched: r23_noAuth.status === 401 && r23_auth.status === 200
    });

    // 24. GET /admin/events/:id/bookings (🔒 админ)
    console.log('Testing 24/25: GET /admin/events/:id/bookings');
    const r24_noAuth = await request(server).get(`/admin/events/${eventIdToModify}/bookings`);
    const r24_auth = await request(server).get(`/admin/events/${eventIdToModify}/bookings`)
      .set('Authorization', `Bearer ${createdResources.adminAccessToken}`);
    results.push({
      num: 24, category: 'Админские ивенты', method: 'GET', path: '/admin/events/:id/bookings (🔒)',
      note: 'Брони ивента для админа (без токена: ' + r24_noAuth.status + ', с токеном: ' + r24_auth.status + ')',
      expectedStatus: 'без токена: 401, с токеном: 200',
      actualStatus: r24_auth.status, requestBody: null,
      responseBody: { noAuth: { status: r24_noAuth.status, body: r24_noAuth.body }, auth: { status: r24_auth.status, body: r24_auth.body } },
      matched: r24_noAuth.status === 401 && r24_auth.status === 200
    });

    // 25. DELETE /admin/events/:id (🔒 админ - строго последним)
    console.log('Testing 25/25: DELETE /admin/events/:id');
    const r25_noAuth = await request(server).delete(`/admin/events/${createdResources.createdEventId}`);
    const r25_auth = await request(server).delete(`/admin/events/${createdResources.createdEventId}`)
      .set('Authorization', `Bearer ${createdResources.adminAccessToken}`);
    results.push({
      num: 25, category: 'Админские ивенты', method: 'DELETE', path: '/admin/events/:id (🔒)',
      note: 'Удаление ивента (без токена: ' + r25_noAuth.status + ', с токеном: ' + r25_auth.status + ')',
      expectedStatus: 'без токена: 401, с токеном: 200',
      actualStatus: r25_auth.status, requestBody: null,
      responseBody: { noAuth: { status: r25_noAuth.status, body: r25_noAuth.body }, auth: { status: r25_auth.status, body: r25_auth.body } },
      matched: r25_noAuth.status === 401 && r25_auth.status === 200
    });
  }

  // Cleanup check: compare GET /events after cleanup
  console.log('\n--- Cleanup Check: GET /events (After) ---');
  const resFinalEvents = await request(server).get('/events');
  const finalEventsState = JSON.stringify(resFinalEvents.body);
  const cleanupMatched = initialEventsState === finalEventsState;
  console.log('Cleanup matched initial state exactly?', cleanupMatched);

  await app.close();

  fs.writeFileSync('./audit-results.json', JSON.stringify({ results, createdResources, cleanupMatched }, null, 2));
  console.log('✅ Audit finished successfully. Output written to audit-results.json');
}

runAudit().catch((err) => {
  console.error('❌ Error during audit run:', err);
  process.exit(1);
});
