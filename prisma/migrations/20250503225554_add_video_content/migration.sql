/*
  Warnings:

  - A unique constraint covering the columns `[video_id]` on the table `Episode` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "VideoType" AS ENUM ('TRAILER', 'FULL_MOVIE', 'EPISODE');

-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'ERROR');

-- AlterTable
ALTER TABLE "Episode" ADD COLUMN     "video_id" INTEGER;

-- AlterTable
ALTER TABLE "ParserSettings" ADD COLUMN     "isEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "VideoContent" (
    "id" SERIAL NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "duration" INTEGER,
    "format" TEXT NOT NULL,
    "quality" TEXT NOT NULL,
    "size" INTEGER,
    "type" "VideoType" NOT NULL,
    "status" "VideoStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "media_trailer_id" INTEGER,
    "media_video_id" INTEGER,

    CONSTRAINT "VideoContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Episode_video_id_key" ON "Episode"("video_id");

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "VideoContent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoContent" ADD CONSTRAINT "VideoContent_media_trailer_id_fkey" FOREIGN KEY ("media_trailer_id") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoContent" ADD CONSTRAINT "VideoContent_media_video_id_fkey" FOREIGN KEY ("media_video_id") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
