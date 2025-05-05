-- CreateTable
CREATE TABLE "MediaChange" (
    "id" SERIAL NOT NULL,
    "media_id" INTEGER NOT NULL,
    "history_id" INTEGER NOT NULL,
    "field_name" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "change_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaChange_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MediaChange" ADD CONSTRAINT "MediaChange_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaChange" ADD CONSTRAINT "MediaChange_history_id_fkey" FOREIGN KEY ("history_id") REFERENCES "ParserHistory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
