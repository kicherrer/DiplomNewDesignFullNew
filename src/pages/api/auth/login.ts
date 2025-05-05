import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../config/database';
import { comparePassword, generateToken } from '../../../utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  try {
    // Получаем пользователя по email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        password_hash: true,
        is_verified: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    // Проверяем подтверждение email
    if (!user.is_verified) {
      return res.status(401).json({ error: 'Email не подтвержден' });
    }

    // Проверяем пароль
    const isValidPassword = await comparePassword(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    // Генерируем токен
    const token = generateToken(user.id);

    res.status(200).json({
      token,
      message: 'Успешный вход'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Ошибка при входе в систему' });
  }
}