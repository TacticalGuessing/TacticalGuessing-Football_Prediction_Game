/*
  Warnings:

  - A unique constraint covering the columns `[round_id,home_team,away_team,match_time]` on the table `fixtures` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "fixtures" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "rounds" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "fixtures_round_teams_time_key" ON "fixtures"("round_id", "home_team", "away_team", "match_time");
