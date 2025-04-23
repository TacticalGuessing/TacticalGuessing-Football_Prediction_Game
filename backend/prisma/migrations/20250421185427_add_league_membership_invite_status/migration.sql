-- DropIndex
DROP INDEX "league_memberships_user_id_idx";

-- AlterTable
ALTER TABLE "league_memberships" ADD COLUMN     "invited_at" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACCEPTED',
ALTER COLUMN "joined_at" DROP NOT NULL,
ALTER COLUMN "joined_at" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "league_memberships_user_id_status_idx" ON "league_memberships"("user_id", "status");
