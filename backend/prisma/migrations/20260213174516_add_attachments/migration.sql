-- AlterTable
ALTER TABLE "FeedItem" ADD COLUMN "attachments" JSONB;

-- AlterTable
ALTER TABLE "ScrapMessage" ADD COLUMN "attachments" JSONB;
