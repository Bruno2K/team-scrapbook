-- Add narrowly scoped deduplication for logical notifications. Existing rows remain nullable.
ALTER TABLE "Notification" ADD COLUMN "dedupeKey" TEXT;

-- Add caller-scoped HTTP retry identity for chat messages. Existing and keyless writes remain valid.
ALTER TABLE "ChatMessage" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN "requestFingerprint" TEXT;

CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");
CREATE UNIQUE INDEX "ChatMessage_senderId_idempotencyKey_key"
  ON "ChatMessage"("senderId", "idempotencyKey");
