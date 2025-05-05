-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "actors" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "crew" JSONB,
ADD COLUMN     "director" TEXT,
ADD COLUMN     "writers" TEXT[] DEFAULT ARRAY[]::TEXT[];
