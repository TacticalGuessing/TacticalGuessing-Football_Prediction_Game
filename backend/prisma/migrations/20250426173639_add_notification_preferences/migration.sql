-- AlterTable
ALTER TABLE "users" ADD COLUMN     "notifies_deadline_reminder" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifies_new_round" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifies_round_results" BOOLEAN NOT NULL DEFAULT true;
