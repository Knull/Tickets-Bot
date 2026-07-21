-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Ticket" (
    "id" SERIAL NOT NULL,
    "ticketNumber" INTEGER NOT NULL,
    "ticketType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticketMessageId" TEXT,
    "reason" TEXT,
    "reportedUser" TEXT,
    "inviteLink" TEXT,
    "proofUrls" JSONB,
    "transcriptUrl" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "added_user" JSONB,
    "added_roles" JSONB,
    "duration" INTEGER,
    "outsideMessageId" TEXT,
    "logMessageUrl" TEXT,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "ticketCounter" INTEGER NOT NULL,

    CONSTRAINT "TicketSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerProfile" (
    "id" SERIAL NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "ign" TEXT NOT NULL,
    "lastSeen" TIMESTAMP(3),
    "ranks" JSONB,
    "clanName" TEXT,
    "rankInfo" JSONB,
    "friends" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketConfig" (
    "id" SERIAL NOT NULL,
    "ticketType" TEXT NOT NULL,
    "permissions" JSONB,
    "allowCustomInstructions" BOOLEAN NOT NULL DEFAULT false,
    "useCustomInstructions" BOOLEAN NOT NULL DEFAULT false,
    "instructions" TEXT,
    "previewTitle" TEXT,

    CONSTRAINT "TicketConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketBlacklist" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketBlacklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerProfile_discordUserId_key" ON "PlayerProfile"("discordUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketConfig_ticketType_key" ON "TicketConfig"("ticketType");

-- CreateIndex
CREATE UNIQUE INDEX "TicketBlacklist_userId_key" ON "TicketBlacklist"("userId");
