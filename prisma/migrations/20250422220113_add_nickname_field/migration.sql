-- AlterTable
ALTER TABLE "User" ADD COLUMN     "nickname" TEXT;

-- CreateTable
CREATE TABLE "ParserHistory" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "details" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "itemsProcessed" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT[],

    CONSTRAINT "ParserHistory_pkey" PRIMARY KEY ("id")
);
