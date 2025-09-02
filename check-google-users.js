const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkGoogleUsers() {
  try {
    console.log('🔍 Проверяем Google пользователей в базе данных...\n');

    // Подсчитываем общее количество пользователей
    const userCount = await prisma.user.count();
    console.log(`📊 Всего пользователей в базе: ${userCount}\n`);

    // Подсчитываем Google пользователей
    const googleUserCount = await prisma.user.count({
      where: {
        googleId: { not: null }
      }
    });
    console.log(`🔑 Google пользователей: ${googleUserCount}\n`);

    // Подсчитываем пользователей с Firebase UID
    const firebaseUserCount = await prisma.user.count({
      where: {
        firebaseUid: { not: null }
      }
    });
    console.log(`🔥 Пользователей с Firebase UID: ${firebaseUserCount}\n`);

    // Подсчитываем пользователей с паролем
    const passwordUserCount = await prisma.user.count({
      where: {
        password: { not: null }
      }
    });
    console.log(`🔐 Пользователей с паролем: ${passwordUserCount}\n`);

    if (userCount > 0) {
      // Получаем всех пользователей с детальной информацией
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          googleId: true,
          firebaseUid: true,
          password: true,
          avatar: true,
          isActive: true,
          createdAt: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      console.log('📋 Детальная информация о пользователях:\n');

      users.forEach((user, index) => {
        const userType = [];
        if (user.googleId) userType.push('Google');
        if (user.firebaseUid) userType.push('Firebase');
        if (user.password) userType.push('Password');

        console.log(`👤 Пользователь ${index + 1}:`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Имя: ${user.firstName || 'Не указано'}`);
        console.log(`   Фамилия: ${user.lastName || 'Не указано'}`);
        console.log(`   Тип: ${userType.join(' + ') || 'Не определен'}`);
        console.log(`   Google ID: ${user.googleId || 'Не привязан'}`);
        console.log(`   Firebase UID: ${user.firebaseUid || 'Не привязан'}`);
        console.log(`   Аватар: ${user.avatar ? 'Есть' : 'Нет'}`);
        console.log(`   Активен: ${user.isActive ? 'Да' : 'Нет'}`);
        console.log(`   Создан: ${user.createdAt.toLocaleString('ru-RU')}`);
        console.log('');
      });

      // Анализ связей
      console.log('🔗 Анализ связей:\n');

      const googleWithFirebase = users.filter(u => u.googleId && u.firebaseUid).length;
      const googleWithoutFirebase = users.filter(u => u.googleId && !u.firebaseUid).length;
      const passwordWithFirebase = users.filter(u => u.password && u.firebaseUid).length;
      const passwordWithoutFirebase = users.filter(u => u.password && !u.firebaseUid).length;

      console.log(`✅ Google + Firebase: ${googleWithFirebase}`);
      console.log(`❌ Google без Firebase: ${googleWithoutFirebase}`);
      console.log(`✅ Password + Firebase: ${passwordWithFirebase}`);
      console.log(`❌ Password без Firebase: ${passwordWithoutFirebase}`);

      if (googleWithoutFirebase > 0) {
        console.log(`\n⚠️  ВНИМАНИЕ: ${googleWithoutFirebase} Google пользователей не имеют Firebase UID!`);
        console.log('   Они получат Firebase UID при следующем входе через Google.');
      }

    } else {
      console.log('❌ Пользователи не найдены');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkGoogleUsers();
