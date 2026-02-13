-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PostComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feedItemId" TEXT,
    "scrapId" TEXT,
    "parentId" TEXT,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostComment_feedItemId_fkey" FOREIGN KEY ("feedItemId") REFERENCES "FeedItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PostComment_scrapId_fkey" FOREIGN KEY ("scrapId") REFERENCES "ScrapMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PostComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PostComment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PostComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PostComment" ("content", "createdAt", "feedItemId", "id", "parentId", "userId") SELECT "content", "createdAt", "feedItemId", "id", "parentId", "userId" FROM "PostComment";
DROP TABLE "PostComment";
ALTER TABLE "new_PostComment" RENAME TO "PostComment";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
