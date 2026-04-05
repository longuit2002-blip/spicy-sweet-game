-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomSessionSnapshot" (
    "roomCode" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "maxPlayers" INTEGER NOT NULL,
    "roomState" JSONB NOT NULL,
    "gameState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomSessionSnapshot_pkey" PRIMARY KEY ("roomCode")
);

-- CreateTable
CREATE TABLE "MatchSummary" (
    "id" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "playerCount" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "winnerIds" TEXT[],
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchSummary_roomCode_finishedAt_idx" ON "MatchSummary"("roomCode", "finishedAt");
