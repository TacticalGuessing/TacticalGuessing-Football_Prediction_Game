/*
  Warnings:

  - A unique constraint covering the columns `[password_reset_token]` on the table `news_items` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "news_items" ADD COLUMN     "password_reset_expires" TIMESTAMP(3),
ADD COLUMN     "password_reset_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "news_items_password_reset_token_key" ON "news_items"("password_reset_token");
