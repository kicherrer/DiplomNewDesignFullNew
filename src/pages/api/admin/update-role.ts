import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '@/utils/auth';

type DecodedToken = {
  userId: number;
  role?: 'USER' | 'ADMIN';
};

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не поддерживается' });
  }

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  const { userId, action } = req.body;

  try {
    const decoded = await verifyToken(token) as DecodedToken;
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: 'Недействительный токен' });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!currentUser || currentUser.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    if (!userId || !action) {
      return res.status(400).json({ error: 'Некорректные данные' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    let updateData = {};

    switch (action) {
      case 'makeAdmin':
        updateData = { role: 'ADMIN' };
        break;
      case 'removeAdmin':
        updateData = { role: 'USER' };
        break;
      case 'block':
        updateData = { is_blocked: true };
        break;
      case 'unblock':
        updateData = { is_blocked: false };
        break;
      default:
        return res.status(400).json({ error: 'Неизвестное действие' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData
    });

    return res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Update User API Error:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    await prisma.$disconnect();
  }
}