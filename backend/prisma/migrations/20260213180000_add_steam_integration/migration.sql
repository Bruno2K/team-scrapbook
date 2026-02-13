-- AlterTable
ALTER TABLE "User" ADD COLUMN "steamId64" TEXT;
ALTER TABLE "User" ADD COLUMN "steamLinkedAt" DATETIME;

-- CreateTable
CREATE TABLE "UserSteamGame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "appId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "iconUrl" TEXT,
    "playtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "playtime2WeeksMinutes" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserSteamGame_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserSteamAchievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "appId" INTEGER NOT NULL,
    "apiName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "iconUrl" TEXT,
    "unlockedAt" DATETIME,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserSteamAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_steamId64_key" ON "User"("steamId64");

-- CreateIndex
CREATE UNIQUE INDEX "UserSteamGame_userId_appId_key" ON "UserSteamGame"("userId", "appId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSteamAchievement_userId_appId_apiName_key" ON "UserSteamAchievement"("userId", "appId", "apiName");
