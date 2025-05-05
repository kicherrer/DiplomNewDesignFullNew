import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/config/database';
import { verifyToken } from '@/utils/auth';
import { MediaStatus, ParserHistory, Media, Prisma } from '@prisma/client';

type MediaChange = {
  id: number;
  media: Media;
  media_id: number;
  history_id: number;
  field_name: string;
  old_value?: string | null;
  new_value?: string | null;
  change_type: string;
  created_at: Date;
  modified_by?: number | null;
  changes: Prisma.JsonValue;
};

type ParserHistoryWithIncludes = ParserHistory & {
  mediaChanges: MediaChange[];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ParserHistoryWithIncludes[] | { message: string } | { error: string }>
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const token = authHeader.split(' ')[1];
    const payload = await verifyToken(token);

    if (!payload || typeof payload.userId !== 'number') {
      return res.status(401).json({ error: 'Недействительный токен' });
    }

    // Проверка прав администратора
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { role: true }
    });

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    if (req.method === 'GET') {
      const parserHistory = await prisma.parserHistory.findMany({
        orderBy: {
          startTime: 'desc'
        },
        take: 50,
        include: {
          mediaChanges: {
            include: {
              media: true
            }
          }
        }
      });

      return res.status(200).json(parserHistory);
    }

    if (req.method === 'PUT' && req.query.id) {
      const historyId = parseInt(req.query.id as string);
      const { mediaId, changes } = req.body;

      // Проверяем существование записи в истории
      const historyEntry = await prisma.parserHistory.findUnique({
        where: { id: historyId },
        include: { mediaChanges: true }
      });

      if (!historyEntry) {
        return res.status(404).json({ error: 'Запись истории не найдена' });
      }

      // Обновляем медиаконтент
      await prisma.media.update({
        where: { id: mediaId },
        data: {
          ...changes,
          status: changes.videos?.length > 0 ? MediaStatus.READY : 
                 changes.trailers?.length > 0 ? MediaStatus.TRAILER : 
                 MediaStatus.NO_VIDEO
        }
      });

      // Обновляем запись в истории
      await prisma.parserHistory.update({
        where: { id: historyId },
        data: {
          details: `Обновлено пользователем ${payload.userId}`,
          mediaChanges: {
            create: [{
              media_id: mediaId,
              changes: changes,
              modified_by: payload.userId,
              field_name: 'content',
              change_type: 'UPDATE'
            }]
          }
        }
      });

      return res.status(200).json({ message: 'Изменения сохранены успешно' });
    }

    return res.status(405).json({ error: 'Метод не поддерживается' });
  } catch (error) {
    console.error('Error in parser history endpoint:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
}