import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '@/utils/auth';

type DecodedToken = {
  userId: number;
  role?: 'USER' | 'ADMIN';
};

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Метод не поддерживается' });
  }

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  try {
    const decoded = await verifyToken(token) as DecodedToken;
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: 'Недействительный токен' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true }
    });

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        is_verified: true,
        created_at: true
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    return res.status(200).json(users);
  } catch (error) {
    console.error('Users API Error:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    await prisma.$disconnect();
  }
}