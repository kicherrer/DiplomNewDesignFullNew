-- CreateTable
CREATE TABLE "VideoSource" (
    "id" SERIAL NOT NULL,
    "media_id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "quality" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoSource_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VideoSource" ADD CONSTRAINT "VideoSource_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;