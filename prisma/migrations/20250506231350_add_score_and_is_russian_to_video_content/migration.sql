-- AlterTable
ALTER TABLE "VideoContent" ADD COLUMN     "is_russian" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "score" INTEGER NOT NULL DEFAULT 0;
