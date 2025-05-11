import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/utils/auth';
import { UserRole } from '@prisma/client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;
  const { id, fileId } = req.query;

  // Проверка авторизации
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    const decoded = await verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Недействительный токен' });
    }

    // Получаем информацию о пользователе из базы данных для проверки роли
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true }
    });

    if (!user || user.role !== UserRole.ADMIN) {
      console.log('Попытка доступа с ролью:', user?.role);
      return res.status(403).json({ error: 'Недостаточно прав для выполнения этой операции' });
    }
  } catch (error) {
    console.error('Ошибка при проверке токена:', error);
    return res.status(401).json({ error: 'Ошибка при проверке авторизации' });
  }

  // Проверка параметров
  if (!id || !fileId || Array.isArray(id) || Array.isArray(fileId)) {
    return res.status(400).json({ error: 'Неверные параметры запроса' });
  }

  const contentId = parseInt(id);
  const mediaFileId = parseInt(fileId);

  switch (method) {
    case 'PUT':
      try {
        const { url } = req.body;
        if (!url) {
          return res.status(400).json({ error: 'URL обязателен' });
        }

        const updatedFile = await prisma.videoContent.update({
          where: {
            id: mediaFileId,
            OR: [
              { media_video_id: contentId },
              { media_trailer_id: contentId }
            ]
          },
          data: { url }
        });

        return res.status(200).json(updatedFile);
      } catch (error) {
        console.error('Ошибка при обновлении медиа-файла:', error);
        return res.status(500).json({ error: 'Ошибка при обновлении медиа-файла' });
      }

    case 'DELETE':
      try {
        await prisma.videoContent.delete({
          where: {
            id: mediaFileId,
            OR: [
              { media_video_id: contentId },
              { media_trailer_id: contentId }
            ]
          }
        });

        return res.status(200).json({ message: 'Медиа-файл успешно удален' });
      } catch (error) {
        console.error('Ошибка при удалении медиа-файла:', error);
        return res.status(500).json({ error: 'Ошибка при удалении медиа-файла' });
      }

    default:
      res.setHeader('Allow', ['PUT', 'DELETE']);
      return res.status(405).json({ error: `Метод ${method} не поддерживается` });
  }
}