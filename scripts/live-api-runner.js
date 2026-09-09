/**
 * Автономный скрипт для тестирования 25 API-роутов бэкенда NestJS
 * 
 * Запуск:
 *   node scripts/live-api-runner.js [BASE_URL]
 * 
 * По умолчанию BASE_URL: https://project-alfa-backend-pevqwdw4la-uc.a.run.app
 * Требования: Node.js версии 18+ (используется встроенный fetch)
 */

const fs = require('fs');

const BASE_URL = process.argv[2] || process.env.API_URL || 'https://project-alfa-backend-pevqwdw4la-uc.a.run.app';

console.log(`🚀 Начинаем тестирование 25 роутов на стенде: ${BASE_URL}\n`);

const results = [];
const state = {
  userEmail: `slava+e2e${Date.now()}@example.com`,
  userPassword: process.env.TEST_USER_PASSWORD || 'Password123!',
  userAccessToken: '',
  userRefreshTokenCookie: '',
  adminEmail: process.env.ADMIN_EMAIL || '',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  adminAccessToken: '',
  adminRefreshTokenCookie: '',
  createdEventId: '',
  createdBookingId: '',
  firstEventId: '',
};

function extractCookie(headers, cookieName) {
  const getSetCookie = headers.getSetCookie ? headers.getSetCookie() : [];
  for (const cookieStr of getSetCookie) {
    if (cookieStr.startsWith(`${cookieName}=`)) {
      return cookieStr.split(';')[0];
    }
  }
  return '';
}

async function makeRequest(method, path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  
  const fetchOptions = {
    method,
    headers,
  };

  if (options.body) {
    fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  try {
    const res = await fetch(url, fetchOptions);
    let bodyText = await res.text();
    let bodyJson = null;
    try {
      bodyJson = JSON.parse(bodyText);
    } catch (e) {
      bodyJson = bodyText;
    }

    return {
      status: res.status,
      headers: res.headers,
      body: bodyJson,
    };
  } catch (err) {
    return {
      status: 0,
      headers: new Headers(),
      body: { error: err.message },
    };
  }
}

async function run() {
  // 1. GET /
  console.log('1/25 GET /');
  const r1 = await makeRequest('GET', '/');
  results.push({ num: 1, method: 'GET', path: '/', status: r1.status, reqBody: null, resBody: r1.body });

  // 2. GET /health
  console.log('2/25 GET /health');
  const r2 = await makeRequest('GET', '/health');
  results.push({ num: 2, method: 'GET', path: '/health', status: r2.status, reqBody: null, resBody: r2.body });

  // 3. POST /auth/register
  console.log('3/25 POST /auth/register');
  const regBody = { email: state.userEmail, password: state.userPassword, name: 'Slava E2E' };
  const r3 = await makeRequest('POST', '/auth/register', { body: regBody });
  if (r3.status === 201 || r3.status === 200) {
    state.userAccessToken = r3.body?.data?.access_token || r3.body?.access_token || '';
    state.userRefreshTokenCookie = extractCookie(r3.headers, 'refresh_token');
  }
  results.push({ num: 3, method: 'POST', path: '/auth/register', status: r3.status, reqBody: regBody, resBody: r3.body });

  // 4. POST /auth/login
  console.log('4/25 POST /auth/login');
  const loginBody = { email: state.userEmail, password: state.userPassword };
  const r4 = await makeRequest('POST', '/auth/login', { body: loginBody });
  if (r4.status === 200) {
    state.userAccessToken = r4.body?.data?.access_token || r4.body?.access_token || state.userAccessToken;
    const cookie = extractCookie(r4.headers, 'refresh_token');
    if (cookie) state.userRefreshTokenCookie = cookie;
  }
  results.push({ num: 4, method: 'POST', path: '/auth/login', status: r4.status, reqBody: loginBody, resBody: r4.body });

  // 5. POST /auth/google
  console.log('5/25 POST /auth/google');
  const googleBody = { idToken: 'fake-google-token-123' };
  const r5 = await makeRequest('POST', '/auth/google', { body: googleBody });
  results.push({ num: 5, method: 'POST', path: '/auth/google', status: r5.status, reqBody: googleBody, resBody: r5.body });

  // 6. POST /auth/refresh
  console.log('6/25 POST /auth/refresh');
  const headersRef = state.userRefreshTokenCookie ? { Cookie: state.userRefreshTokenCookie } : {};
  const r6_1 = await makeRequest('POST', '/auth/refresh', { headers: headersRef });
  const r6_2 = await makeRequest('POST', '/auth/refresh', { headers: headersRef }); // Повторный вызов
  results.push({
    num: 6, method: 'POST', path: '/auth/refresh', status: r6_1.status,
    reqBody: null, resBody: { attempt1_status: r6_1.status, attempt2_status: r6_2.status, attempt1_body: r6_1.body, attempt2_body: r6_2.body }
  });

  // 7. POST /auth/logout
  console.log('7/25 POST /auth/logout');
  const r7 = await makeRequest('POST', '/auth/logout', { headers: headersRef });
  results.push({ num: 7, method: 'POST', path: '/auth/logout', status: r7.status, reqBody: null, resBody: r7.body });

  // 8. POST /auth/send-password-reset
  console.log('8/25 POST /auth/send-password-reset');
  const resetBody = { email: state.userEmail };
  const r8 = await makeRequest('POST', '/auth/send-password-reset', { body: resetBody });
  results.push({ num: 8, method: 'POST', path: '/auth/send-password-reset', status: r8.status, reqBody: resetBody, resBody: r8.body });

  // Re-login user to get fresh token for protected routes
  const r4_re = await makeRequest('POST', '/auth/login', { body: loginBody });
  if (r4_re.status === 200) {
    state.userAccessToken = r4_re.body?.data?.access_token || r4_re.body?.access_token;
  }
  const userAuthHeader = state.userAccessToken ? { Authorization: `Bearer ${state.userAccessToken}` } : {};

  // 9. POST /auth/change-password
  console.log('9/25 POST /auth/change-password (🔒)');
  const changePassBody = { currentPassword: state.userPassword, newPassword: state.userPassword };
  const r9_noAuth = await makeRequest('POST', '/auth/change-password', { body: changePassBody });
  const r9_auth = await makeRequest('POST', '/auth/change-password', { headers: userAuthHeader, body: changePassBody });
  results.push({
    num: 9, method: 'POST', path: '/auth/change-password (🔒)', status: r9_auth.status,
    reqBody: changePassBody, resBody: { without_token: r9_noAuth.status, with_token: r9_auth.status, body: r9_auth.body }
  });

  // 10. POST /auth/profile
  console.log('10/25 POST /auth/profile (🔒)');
  const profileBody = { nickname: 'Slava Tester' };
  const r10_noAuth = await makeRequest('POST', '/auth/profile', { body: profileBody });
  const r10_auth = await makeRequest('POST', '/auth/profile', { headers: userAuthHeader, body: profileBody });
  results.push({
    num: 10, method: 'POST', path: '/auth/profile (🔒)', status: r10_auth.status,
    reqBody: profileBody, resBody: { without_token: r10_noAuth.status, with_token: r10_auth.status, body: r10_auth.body }
  });

  // 11. GET /auth/debug/token-info
  console.log('11/25 GET /auth/debug/token-info (🔒)');
  const r11_noAuth = await makeRequest('GET', '/auth/debug/token-info');
  const r11_auth = await makeRequest('GET', '/auth/debug/token-info', { headers: userAuthHeader });
  results.push({
    num: 11, method: 'GET', path: '/auth/debug/token-info (🔒)', status: r11_auth.status,
    reqBody: null, resBody: { without_token: r11_noAuth.status, with_token: r11_auth.status, body: r11_auth.body }
  });

  // 12. GET /protected/profile
  console.log('12/25 GET /protected/profile (🔒)');
  const r12_noAuth = await makeRequest('GET', '/protected/profile');
  const r12_auth = await makeRequest('GET', '/protected/profile', { headers: userAuthHeader });
  results.push({
    num: 12, method: 'GET', path: '/protected/profile (🔒)', status: r12_auth.status,
    reqBody: null, resBody: { without_token: r12_noAuth.status, with_token: r12_auth.status, body: r12_auth.body }
  });

  // 13. GET /events
  console.log('13/25 GET /events');
  const r13 = await makeRequest('GET', '/events?page=1&limit=10');
  const eventsList = r13.body?.data?.events || r13.body?.data || (Array.isArray(r13.body) ? r13.body : []);
  state.firstEventId = eventsList[0]?.id || '';
  results.push({ num: 13, method: 'GET', path: '/events', status: r13.status, reqBody: null, resBody: r13.body });

  // 14. GET /events/:id
  console.log('14/25 GET /events/:id');
  const testId = state.firstEventId || 'non-existent-uuid-99999';
  const r14_valid = await makeRequest('GET', `/events/${testId}`);
  const r14_invalid = await makeRequest('GET', '/events/non-existent-uuid-99999');
  results.push({
    num: 14, method: 'GET', path: '/events/:id', status: r14_valid.status,
    reqBody: null, resBody: { valid_id_status: r14_valid.status, invalid_id_status: r14_invalid.status, invalid_body: r14_invalid.body }
  });

  // 15. POST /events/:id/book
  console.log('15/25 POST /events/:id/book');
  const r15_over = await makeRequest('POST', `/events/${testId}/book`, { body: { name: 'Over', email: 'over@test.com', participant_count: 99999 } });
  const r15_zero = await makeRequest('POST', `/events/${testId}/book`, { body: { name: 'Zero', email: 'zero@test.com', participant_count: 0 } });
  const r15_neg = await makeRequest('POST', `/events/${testId}/book`, { body: { name: 'Neg', email: 'neg@test.com', participant_count: -1 } });
  const r15_normal = await makeRequest('POST', `/events/${testId}/book`, { body: { name: 'Normal', email: 'normal@test.com', participant_count: 1 } });
  if (r15_normal.status === 201 || r15_normal.status === 200) {
    state.createdBookingId = r15_normal.body?.data?.id || r15_normal.body?.id;
  }
  results.push({
    num: 15, method: 'POST', path: '/events/:id/book', status: r15_normal.status,
    reqBody: { participant_count_tests: [99999, 0, -1, 1] },
    resBody: { over_capacity: r15_over.status, zero_count: r15_zero.status, negative_count: r15_neg.status, normal_count: r15_normal.status }
  });

  // 16. GET /events/:id/bookings
  console.log('16/25 GET /events/:id/bookings');
  const r16 = await makeRequest('GET', `/events/${testId}/bookings`);
  results.push({ num: 16, method: 'GET', path: '/events/:id/bookings', status: r16.status, reqBody: null, resBody: r16.body });

  // 17. POST /admin/auth/login
  console.log('17/25 POST /admin/auth/login');
  const adminLoginBody = { email: state.adminEmail, password: state.adminPassword };
  const r17 = await makeRequest('POST', '/admin/auth/login', { body: adminLoginBody });
  if (r17.status === 200) {
    state.adminAccessToken = r17.body?.data?.access_token || r17.body?.access_token || '';
    state.adminRefreshTokenCookie = extractCookie(r17.headers, 'admin_refresh_token');
  }
  results.push({ num: 17, method: 'POST', path: '/admin/auth/login', status: r17.status, reqBody: adminLoginBody, resBody: r17.body });

  // 18. POST /admin/auth/refresh
  console.log('18/25 POST /admin/auth/refresh');
  const adminCookieHeader = state.adminRefreshTokenCookie ? { Cookie: state.adminRefreshTokenCookie } : {};
  const r18 = await makeRequest('POST', '/admin/auth/refresh', { headers: adminCookieHeader });
  results.push({ num: 18, method: 'POST', path: '/admin/auth/refresh', status: r18.status, reqBody: null, resBody: r18.body });

  // 19. POST /admin/auth/logout
  console.log('19/25 POST /admin/auth/logout (🔒)');
  const adminAuthHeader = state.adminAccessToken ? { Authorization: `Bearer ${state.adminAccessToken}` } : {};
  const r19_noAuth = await makeRequest('POST', '/admin/auth/logout');
  const r19_auth = await makeRequest('POST', '/admin/auth/logout', { headers: { ...adminAuthHeader, ...adminCookieHeader } });
  results.push({
    num: 19, method: 'POST', path: '/admin/auth/logout (🔒)', status: r19_auth.status,
    reqBody: null, resBody: { without_token: r19_noAuth.status, with_token: r19_auth.status, body: r19_auth.body }
  });

  // Re-login admin for 20-25
  const r17_re = await makeRequest('POST', '/admin/auth/login', { body: adminLoginBody });
  if (r17_re.status === 200) {
    state.adminAccessToken = r17_re.body?.data?.access_token || r17_re.body?.access_token || state.adminAccessToken;
  }
  const freshAdminAuthHeader = state.adminAccessToken ? { Authorization: `Bearer ${state.adminAccessToken}` } : {};

  // 20. GET /admin/events
  console.log('20/25 GET /admin/events (🔒)');
  const r20_noAuth = await makeRequest('GET', '/admin/events');
  const r20_auth = await makeRequest('GET', '/admin/events', { headers: freshAdminAuthHeader });
  results.push({
    num: 20, method: 'GET', path: '/admin/events (🔒)', status: r20_auth.status,
    reqBody: null, resBody: { without_token: r20_noAuth.status, with_token: r20_auth.status, body: r20_auth.body }
  });

  // 21. POST /admin/events
  console.log('21/25 POST /admin/events (🔒)');
  const r21_noAuth = await makeRequest('POST', '/admin/events', { body: { title: 'Test' } });
  const r21_badBody = await makeRequest('POST', '/admin/events', { headers: freshAdminAuthHeader, body: { title: '' } });
  const newEventBody = {
    title: 'E2E Live Audit Event',
    description: 'Event created by automated E2E runner',
    category: 'TECH',
    price: 0,
    date: '2026-10-01',
    start_time: '18:00',
    duration_minutes: 120,
    capacity: 25,
    location: 'Online',
  };
  const r21_goodBody = await makeRequest('POST', '/admin/events', { headers: freshAdminAuthHeader, body: newEventBody });
  if (r21_goodBody.status === 201 || r21_goodBody.status === 200) {
    state.createdEventId = r21_goodBody.body?.data?.id || r21_goodBody.body?.id;
  }
  results.push({
    num: 21, method: 'POST', path: '/admin/events (🔒)', status: r21_goodBody.status,
    reqBody: newEventBody,
    resBody: { without_token: r21_noAuth.status, bad_body_status: r21_badBody.status, with_token: r21_goodBody.status, created_event: r21_goodBody.body }
  });

  if (!state.createdEventId) {
    console.log('⚠️ Skipping steps 22-25: No test event was created on step 21. Refusing to mutate existing production events.');
  } else {
    const targetEventId = state.createdEventId;

    // 22. PUT /admin/events/:id
    console.log('22/25 PUT /admin/events/:id (🔒)');
    const updateBody = {
      title: 'E2E Live Audit Event Updated',
      description: 'Updated description',
      category: 'WORKSHOP',
      price: 1500,
      date: '2026-10-02',
      start_time: '19:00',
      duration_minutes: 90,
      capacity: 50,
      location: 'Online Studio',
    };
    const r22_noAuth = await makeRequest('PUT', `/admin/events/${targetEventId}`, { body: updateBody });
    const r22_auth = await makeRequest('PUT', `/admin/events/${targetEventId}`, { headers: freshAdminAuthHeader, body: updateBody });
    results.push({
      num: 22, method: 'PUT', path: '/admin/events/:id (🔒)', status: r22_auth.status,
      reqBody: updateBody, resBody: { without_token: r22_noAuth.status, with_token: r22_auth.status, body: r22_auth.body }
    });

    // 23. PATCH /admin/events/:id/status
    console.log('23/25 PATCH /admin/events/:id/status (🔒)');
    const statusBody = { status: 'PUBLISHED' };
    const r23_noAuth = await makeRequest('PATCH', `/admin/events/${targetEventId}/status`, { body: statusBody });
    const r23_auth = await makeRequest('PATCH', `/admin/events/${targetEventId}/status`, { headers: freshAdminAuthHeader, body: statusBody });
    results.push({
      num: 23, method: 'PATCH', path: '/admin/events/:id/status (🔒)', status: r23_auth.status,
      reqBody: statusBody, resBody: { without_token: r23_noAuth.status, with_token: r23_auth.status, body: r23_auth.body }
    });

    // 24. GET /admin/events/:id/bookings
    console.log('24/25 GET /admin/events/:id/bookings (🔒)');
    const r24_noAuth = await makeRequest('GET', `/admin/events/${targetEventId}/bookings`);
    const r24_auth = await makeRequest('GET', `/admin/events/${targetEventId}/bookings`, { headers: freshAdminAuthHeader });
    results.push({
      num: 24, method: 'GET', path: '/admin/events/:id/bookings (🔒)', status: r24_auth.status,
      reqBody: null, resBody: { without_token: r24_noAuth.status, with_token: r24_auth.status, body: r24_auth.body }
    });

    // 25. DELETE /admin/events/:id
    console.log('25/25 DELETE /admin/events/:id (🔒)');
    const r25_noAuth = await makeRequest('DELETE', `/admin/events/${state.createdEventId}`);
    const r25_auth = await makeRequest('DELETE', `/admin/events/${state.createdEventId}`, { headers: freshAdminAuthHeader });
    results.push({
      num: 25, method: 'DELETE', path: '/admin/events/:id (🔒)', status: r25_auth.status,
      reqBody: null, resBody: { without_token: r25_noAuth.status, with_token: r25_auth.status, body: r25_auth.body }
    });
  }

  // Генерация Markdown-отчета
  console.log('\n📊 Формирование отчета...');
  let md = `# Отчет тестирования API (${BASE_URL})\n\n`;
  md += `**Дата запуска:** ${new Date().toLocaleString()}\n`;
  md += `**Созданный тестовый юзер:** \`${state.userEmail}\`\n`;
  md += `**Созданный ID ивента:** \`${state.createdEventId || 'Нет'}\`\n\n`;

  md += `| № | Метод | Путь | Код ответа | Тело запроса | Тело ответа |\n`;
  md += `|---|-------|------|------------|--------------|-------------|\n`;

  for (const item of results) {
    const reqStr = item.reqBody ? `\`\`\`json\n${JSON.stringify(item.reqBody, null, 2)}\n\`\`\`` : '—';
    const resStr = item.resBody ? `\`\`\`json\n${JSON.stringify(item.resBody, null, 2)}\n\`\`\`` : '—';
    md += `| ${item.num} | **${item.method}** | \`${item.path}\` | \`${item.status}\` | ${reqStr.replace(/\n/g, '<br>')} | ${resStr.replace(/\n/g, '<br>')} |\n`;
  }

  fs.writeFileSync('./LIVE-TEST-REPORT.md', md);
  console.log('✅ Отчет успешно сохранен в файл: LIVE-TEST-REPORT.md');
}

run().catch((err) => {
  console.error('❌ Ошибка во время выполнения:', err);
});
