/*
  Warnings:

  - Added the required column `source` to the `VideoSource` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "VideoSource" ADD COLUMN     "source" TEXT NOT NULL;
