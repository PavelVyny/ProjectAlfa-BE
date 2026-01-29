const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function viewUsers() {
  try {
    console.log('🔍 Пользователи в базе данных:\n');

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        nickname: true,
        firebaseUid: true,
        createdAt: true,
      },
    });

    if (users.length === 0) {
      console.log('❌ Пользователи не найдены');
    } else {
      users.forEach((user, index) => {
        console.log(`👤 ${index + 1}. ${user.email}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Nickname: ${user.nickname || 'Не указано'}`);
        console.log(`   Firebase UID: ${user.firebaseUid || 'Не привязан'}`);
        console.log(`   Создан: ${user.createdAt.toLocaleString('ru-RU')}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

viewUsers();
