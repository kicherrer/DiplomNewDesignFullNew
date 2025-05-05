import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '@/utils/auth';
import { ContentParser } from '@/services/parser';

const contentParser = new ContentParser();

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const decoded = await verifyToken(token) as { userId: number; role?: string };
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

    if (req.method === 'GET') {
      const history = await prisma.parserHistory.findFirst({
        orderBy: { startTime: 'desc' }
      });

      const settings = await prisma.parserSettings.findFirst();

      return res.status(200).json({
        lastRun: history?.startTime,
        settings: settings || {
          updateInterval: 24,
          autoUpdate: true,
          contentTypes: ['movies', 'series'],
          isEnabled: false
        }
      });
    }

    if (req.method === 'PUT') {
      const { updateInterval, autoUpdate, contentTypes } = req.body;

      const settings = await prisma.parserSettings.upsert({
        where: { id: 1 },
        update: {
          updateInterval,
          autoUpdate,
          contentTypes
        },
        create: {
          id: 1,
          updateInterval,
          autoUpdate,
          contentTypes,
          kinopoiskApiKey: process.env.KINOPOISK_API_KEY || '',
          omdbApiKey: process.env.OMDB_API_KEY || ''
        }
      });

      return res.status(200).json({ settings });
    }

    if (req.method === 'POST') {
      const { action } = req.query;

      if (action === 'start') {
        const historyEntry = await prisma.parserHistory.create({
          data: {
            status: 'RUNNING',
            startTime: new Date(),
            source: 'API',
            details: 'Запуск парсера контента'
          }
        });

        // Получаем список всего контента для проверки
        const allMedia = await prisma.media.findMany({
          select: {
            title: true
          }
        });

        // Обрабатываем существующий контент
        for (const media of allMedia) {
          await contentParser.processContent(media.title);
        }

        // Обновляем статус записи в истории
        await prisma.parserHistory.update({
          where: { id: historyEntry.id },
          data: {
            status: 'COMPLETED',
            endTime: new Date(),
            details: 'Парсер завершил обработку контента'
          }
        });

        return res.status(200).json({ message: 'Парсер завершил работу' });
      }

      if (action === 'stop') {
        const lastRun = await prisma.parserHistory.findFirst({
          where: { status: 'RUNNING' },
          orderBy: { startTime: 'desc' }
        });

        if (lastRun) {
          await prisma.parserHistory.update({
            where: { id: lastRun.id },
            data: {
              status: 'STOPPED',
              endTime: new Date()
            }
          });
        }

        return res.status(200).json({ message: 'Парсер остановлен' });
      }

      return res.status(400).json({ error: 'Неверное действие' });
    }

    return res.status(405).json({ error: 'Метод не поддерживается' });
  } catch (error) {
    console.error('Parser API Error:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  } finally {
    await prisma.$disconnect();
  }
}

export const config = {
  api: {
    bodyParser: true
  }
};