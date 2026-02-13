-- CreateTable
CREATE TABLE "ScrapMessageReaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scrapId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reaction" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScrapMessageReaction_scrapId_fkey" FOREIGN KEY ("scrapId") REFERENCES "ScrapMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScrapMessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ScrapMessageReaction_scrapId_userId_key" ON "ScrapMessageReaction"("scrapId", "userId");
