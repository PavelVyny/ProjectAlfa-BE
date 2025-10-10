const http = require('http');

async function testRegistration() {
  console.log('🧪 Финальный тест регистрации...\n');

  // Ждем 3 секунды, чтобы сервер успел запуститься
  await new Promise(resolve => setTimeout(resolve, 3000));

  const testData = {
    email: `final-test-${Date.now()}@example.com`,
    password: 'password123',
    nickname: 'FinalTest'
  };

  const postData = JSON.stringify(testData);

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  console.log('📤 Отправляем запрос:');
  console.log(JSON.stringify(testData, null, 2));

  const req = http.request(options, (res) => {
    console.log(`\n📥 Статус: ${res.statusCode}`);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('📥 Ответ:');
        console.log(JSON.stringify(response, null, 2));

        if (res.statusCode === 201 && response.user && response.user.nickname === testData.nickname) {
          console.log('\n✅ Регистрация работает! Nickname сохранен корректно!');
        } else {
          console.log('\n❌ Проблема с регистрацией');
        }
      } catch (error) {
        console.log('❌ Ошибка парсинга:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.log('❌ Ошибка:', error.message);
  });

  req.write(postData);
  req.end();
}

testRegistration();
