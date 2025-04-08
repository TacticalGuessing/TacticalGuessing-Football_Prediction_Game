/*
  Warnings:

  - Added the required column `updated_at` to the `fixtures` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `rounds` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "fixtures" ADD COLUMN     "status" TEXT DEFAULT 'SCHEDULED',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "rounds" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "team_name" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;
