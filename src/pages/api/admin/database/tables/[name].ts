import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Метод ${req.method} не поддерживается` });
  }

  try {
    // Проверка авторизации
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const decoded = await verifyToken(token) as { userId: number };
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

    const { name } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    // Проверяем, существует ли такая модель в Prisma
    const modelName = name as keyof typeof prisma;
    if (!(modelName in prisma)) {
      return res.status(404).json({ error: 'Таблица не найдена' });
    }

    // Получаем данные из таблицы с пагинацией
    const data = await (prisma[modelName] as any).findMany({
      take: limit,
      skip: skip,
      orderBy: {
        id: 'desc'
      }
    });

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error in table data handler:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}