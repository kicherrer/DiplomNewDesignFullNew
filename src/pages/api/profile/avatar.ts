import { NextApiRequest, NextApiResponse } from 'next';
import { verifyToken } from '@/utils/auth';
import { prisma } from '@/config/database';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не поддерживается' });
  }

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    const payload = await verifyToken(token);
    if (!payload || typeof payload.userId !== 'number') {
      return res.status(401).json({ error: 'Недействительный токен' });
    }
    const userId = payload.userId;

    const form = formidable({
      uploadDir: path.join(process.cwd(), 'public/uploads'),
      keepExtensions: true,
      maxFileSize: 5 * 1024 * 1024, // 5MB
    });

    const [fields, files] = await form.parse(req);
    const file = files.avatar?.[0];

    if (!file) {
      return res.status(400).json({ error: 'Файл не найден' });
    }

    const fileId = `${Date.now()}-${file.originalFilename}`;
    const newPath = path.join(process.cwd(), 'public/uploads', fileId);

    await fs.promises.rename(file.filepath, newPath);

    const avatarUrl = `/uploads/${fileId}`;
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        avatar_id: fileId,
        avatar_url: avatarUrl
      },
    });

    return res.status(200).json({
      avatar_id: user.avatar_id,
      avatar_url: `/uploads/${fileId}`,
    });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    return res.status(500).json({ error: 'Ошибка при загрузке аватара' });
  }
}