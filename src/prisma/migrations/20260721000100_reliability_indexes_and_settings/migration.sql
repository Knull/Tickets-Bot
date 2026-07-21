-- Persist ticket mode so restarts do not silently switch back to channels.
ALTER TABLE "TicketSettings"
ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'channel',
ADD COLUMN "pingRoles" BOOLEAN NOT NULL DEFAULT false;

-- Support the hot paths used by interaction limits and inactivity sweeps.
CREATE INDEX "Ticket_channelId_idx" ON "Ticket"("channelId");
CREATE INDEX "Ticket_userId_status_createdAt_idx" ON "Ticket"("userId", "status", "createdAt");
CREATE INDEX "Ticket_status_lastMessageAt_idx" ON "Ticket"("status", "lastMessageAt");
CREATE INDEX "Ticket_status_createdAt_idx" ON "Ticket"("status", "createdAt");
CREATE INDEX "TicketBlacklist_expiresAt_idx" ON "TicketBlacklist"("expiresAt");
