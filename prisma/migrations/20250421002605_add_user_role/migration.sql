-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "ParserSettings" (
    "id" SERIAL NOT NULL,
    "kinopoiskApiKey" TEXT NOT NULL,
    "omdbApiKey" TEXT NOT NULL,
    "updateInterval" INTEGER NOT NULL DEFAULT 24,
    "autoUpdate" BOOLEAN NOT NULL DEFAULT false,
    "contentTypes" TEXT[] DEFAULT ARRAY['MOVIE', 'SERIES']::TEXT[],

    CONSTRAINT "ParserSettings_pkey" PRIMARY KEY ("id")
);
