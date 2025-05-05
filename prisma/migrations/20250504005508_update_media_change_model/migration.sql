-- AlterTable
ALTER TABLE "MediaChange" ADD COLUMN     "changes" JSONB,
ADD COLUMN     "modified_by" INTEGER;
