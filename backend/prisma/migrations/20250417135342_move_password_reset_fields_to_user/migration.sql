/*
  Warnings:

  - You are about to drop the column `password_reset_expires` on the `news_items` table. All the data in the column will be lost.
  - You are about to drop the column `password_reset_token` on the `news_items` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[password_reset_token]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "news_items_password_reset_token_key";

-- AlterTable
ALTER TABLE "news_items" DROP COLUMN "password_reset_expires",
DROP COLUMN "password_reset_token";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_reset_expires" TIMESTAMP(3),
ADD COLUMN     "password_reset_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_password_reset_token_key" ON "users"("password_reset_token");
