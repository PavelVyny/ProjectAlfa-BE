const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log('🔍 Проверяем пользователей в базе данных...\n');

    // Подсчитываем общее количество пользователей
    const userCount = await prisma.user.count();
    console.log(`📊 Всего пользователей в базе: ${userCount}\n`);

    if (userCount > 0) {
      // Получаем всех пользователей
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          createdAt: true
        }
      });

      users.forEach((user, index) => {
        console.log(`👤 Пользователь ${index + 1}:`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Имя: ${user.firstName || 'Не указано'}`);
        console.log(`   Фамилия: ${user.lastName || 'Не указано'}`);
        console.log(`   Активен: ${user.isActive ? 'Да' : 'Нет'}`);
        console.log(`   Создан: ${user.createdAt.toLocaleString('ru-RU')}`);
        console.log('');
      });
    } else {
      console.log('❌ Пользователи не найдены');
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();


