import { PrismaClient } from '@prisma/client';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

declare global {
  var prisma: PrismaClient | undefined;
}

const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export { prisma };
export default prisma;

export const uploadAvatar = async (file: formidable.File): Promise<string> => {
  const uploadsDir = path.join(process.cwd(), 'public/uploads');
  const newFileName = `${Date.now()}-${file.originalFilename}`;
  const newPath = path.join(uploadsDir, newFileName);

  await fs.promises.copyFile(file.filepath, newPath);
  await fs.promises.unlink(file.filepath);

  return `/uploads/${newFileName}`;
};