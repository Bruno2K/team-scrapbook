-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "team" TEXT NOT NULL DEFAULT 'RED',
    "mainClass" TEXT NOT NULL DEFAULT 'Scout',
    "level" INTEGER NOT NULL DEFAULT 1,
    "avatar" TEXT,
    "online" BOOLEAN NOT NULL DEFAULT false,
    "isAiManaged" BOOLEAN NOT NULL DEFAULT false,
    "steamId64" TEXT,
    "steamLinkedAt" DATETIME,
    "pinnedAchievementIds" JSONB DEFAULT [],
    "pinnedPostIds" JSONB DEFAULT [],
    "birthDate" DATETIME,
    "gender" TEXT,
    "favoriteMap" TEXT,
    "playstyle" TEXT,
    "quote" TEXT,
    "country" TEXT,
    "bio" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user1Id" TEXT NOT NULL,
    "user2Id" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Friendship_user1Id_fkey" FOREIGN KEY ("user1Id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Friendship_user2Id_fkey" FOREIGN KEY ("user2Id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FriendshipRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME,
    CONSTRAINT "FriendshipRequest_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FriendshipRequest_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BlockedUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BlockedUser_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BlockedUser_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeedItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'post',
    "communityId" TEXT,
    "allowComments" BOOLEAN NOT NULL DEFAULT true,
    "allowReactions" BOOLEAN NOT NULL DEFAULT true,
    "attachments" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeedItem_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PostComment" (
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

-- CreateTable
CREATE TABLE "FeedItemReaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feedItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reaction" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedItemReaction_feedItemId_fkey" FOREIGN KEY ("feedItemId") REFERENCES "FeedItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeedItemReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommentReaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reaction" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommentReaction_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "PostComment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommentReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user1Id" TEXT NOT NULL,
    "user2Id" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Conversation_user1Id_fkey" FOREIGN KEY ("user1Id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Conversation_user2Id_fkey" FOREIGN KEY ("user2Id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "attachments" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScrapMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "reaction" TEXT,
    "attachments" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScrapMessage_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScrapMessage_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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

-- CreateTable
CREATE TABLE "Community" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "dominantClass" TEXT,
    "team" TEXT,
    "ownerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Community_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommunityInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communityId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityInvite_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunityInvite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunityInvite_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommunityJoinRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityJoinRequest_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunityJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunityJoinRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommunityMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunityMember_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
CREATE UNIQUE INDEX "User_nickname_key" ON "User"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "User_steamId64_key" ON "User"("steamId64");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_user1Id_user2Id_key" ON "Friendship"("user1Id", "user2Id");

-- CreateIndex
CREATE UNIQUE INDEX "FriendshipRequest_fromUserId_toUserId_key" ON "FriendshipRequest"("fromUserId", "toUserId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockedUser_blockerId_blockedId_key" ON "BlockedUser"("blockerId", "blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedItemReaction_feedItemId_userId_key" ON "FeedItemReaction"("feedItemId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommentReaction_commentId_userId_key" ON "CommentReaction"("commentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_user1Id_user2Id_key" ON "Conversation"("user1Id", "user2Id");

-- CreateIndex
CREATE UNIQUE INDEX "ScrapMessageReaction_scrapId_userId_key" ON "ScrapMessageReaction"("scrapId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityInvite_communityId_inviteeId_key" ON "CommunityInvite"("communityId", "inviteeId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityJoinRequest_communityId_userId_key" ON "CommunityJoinRequest"("communityId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityMember_userId_communityId_key" ON "CommunityMember"("userId", "communityId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSteamGame_userId_appId_key" ON "UserSteamGame"("userId", "appId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSteamAchievement_userId_appId_apiName_key" ON "UserSteamAchievement"("userId", "appId", "apiName");
