-- AlterTable
ALTER TABLE "news_items" ADD COLUMN     "posted_by_user_id" INTEGER;

-- AddForeignKey
ALTER TABLE "news_items" ADD CONSTRAINT "news_items_posted_by_user_id_fkey" FOREIGN KEY ("posted_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
