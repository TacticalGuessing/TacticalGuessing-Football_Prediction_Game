-- CreateTable
CREATE TABLE "leagues" (
    "league_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "creator_user_id" INTEGER NOT NULL,
    "invite_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leagues_pkey" PRIMARY KEY ("league_id")
);

-- CreateTable
CREATE TABLE "league_memberships" (
    "membership_id" SERIAL NOT NULL,
    "league_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "league_memberships_pkey" PRIMARY KEY ("membership_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leagues_invite_code_key" ON "leagues"("invite_code");

-- CreateIndex
CREATE INDEX "league_memberships_user_id_idx" ON "league_memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "league_memberships_league_id_user_id_key" ON "league_memberships"("league_id", "user_id");

-- AddForeignKey
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_memberships" ADD CONSTRAINT "league_memberships_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("league_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_memberships" ADD CONSTRAINT "league_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
