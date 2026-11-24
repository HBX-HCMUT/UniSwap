-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "ListingCondition" AS ENUM ('LIKE_NEW', 'GOOD', 'FAIR');

-- CreateEnum
CREATE TYPE "ListingState" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ListingModeration" AS ENUM ('APPROVED', 'PENDING', 'REMOVED');

-- CreateEnum
CREATE TYPE "AssetPurpose" AS ENUM ('LISTING', 'PAYMENT_QR');

-- CreateEnum
CREATE TYPE "ReservationState" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('COD', 'QR_MANUAL');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('MESSAGE', 'RESERVATION', 'NEW_LISTING', 'MODERATION');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SCAM', 'PROHIBITED', 'SPAM', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportState" AS ENUM ('OPEN', 'DISMISSED', 'ACTIONED');

-- CreateEnum
CREATE TYPE "ModerationTarget" AS ENUM ('LISTING', 'USER', 'REPORT');

-- CreateEnum
CREATE TYPE "ModerationAction" AS ENUM ('APPROVE', 'REMOVE', 'LOCK', 'UNLOCK', 'DISMISS');

-- CreateTable
CREATE TABLE "schools" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "googleSub" TEXT,
    "displayName" TEXT NOT NULL,
    "schoolId" UUID,
    "area" TEXT,
    "contact" TEXT,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "verifiedAt" TIMESTAMPTZ(3),
    "lastActiveAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "area" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "condition" "ListingCondition" NOT NULL,
    "state" "ListingState" NOT NULL DEFAULT 'AVAILABLE',
    "moderation" "ListingModeration" NOT NULL DEFAULT 'APPROVED',
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "purpose" "AssetPurpose" NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "listingId" UUID,
    "position" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "buyerId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "buyerId" UUID NOT NULL,
    "state" "ReservationState" NOT NULL DEFAULT 'PENDING',
    "finalPrice" INTEGER,
    "meetingAt" TIMESTAMPTZ(3),
    "meetingPlace" TEXT,
    "paymentMethod" "PaymentMethod",
    "qrAssetId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "targetId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "userId" UUID NOT NULL,
    "listingId" UUID NOT NULL,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("userId","listingId")
);

-- CreateTable
CREATE TABLE "seller_follows" (
    "userId" UUID NOT NULL,
    "sellerId" UUID NOT NULL,

    CONSTRAINT "seller_follows_pkey" PRIMARY KEY ("userId","sellerId")
);

-- CreateTable
CREATE TABLE "category_follows" (
    "userId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,

    CONSTRAINT "category_follows_pkey" PRIMARY KEY ("userId","categoryId")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "resourceId" UUID NOT NULL,
    "eventKey" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT,
    "state" "ReportState" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ(3),
    "resolvedById" UUID,
    "resolutionNote" TEXT,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_logs" (
    "id" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "targetType" "ModerationTarget" NOT NULL,
    "targetId" UUID NOT NULL,
    "action" "ModerationAction" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schools_code_key" ON "schools"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleSub_key" ON "users"("googleSub");

-- CreateIndex
CREATE INDEX "users_role_lastActiveAt_idx" ON "users"("role", "lastActiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_tokenHash_key" ON "verification_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "verification_tokens_userId_idx" ON "verification_tokens"("userId");

-- CreateIndex
CREATE INDEX "sessions_userId_revokedAt_idx" ON "sessions"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE INDEX "listings_moderation_state_schoolId_createdAt_idx" ON "listings"("moderation", "state", "schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "listings_categoryId_price_idx" ON "listings"("categoryId", "price");

-- CreateIndex
CREATE INDEX "listings_sellerId_createdAt_idx" ON "listings"("sellerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "assets_objectKey_key" ON "assets"("objectKey");

-- CreateIndex
CREATE INDEX "assets_listingId_position_idx" ON "assets"("listingId", "position");

-- CreateIndex
CREATE INDEX "assets_ownerId_idx" ON "assets"("ownerId");

-- CreateIndex
CREATE INDEX "conversations_buyerId_createdAt_idx" ON "conversations"("buyerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_listingId_buyerId_key" ON "conversations"("listingId", "buyerId");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_id_idx" ON "messages"("conversationId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "messages_senderId_createdAt_idx" ON "messages"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "reservations_buyerId_createdAt_idx" ON "reservations"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "reservations_listingId_state_idx" ON "reservations"("listingId", "state");

-- CreateIndex
CREATE INDEX "reservations_state_completedAt_idx" ON "reservations"("state", "completedAt");

-- CreateIndex
CREATE INDEX "reservations_qrAssetId_state_idx" ON "reservations"("qrAssetId", "state");

-- CreateIndex
CREATE INDEX "reviews_targetId_createdAt_idx" ON "reviews"("targetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_reservationId_authorId_key" ON "reviews"("reservationId", "authorId");

-- CreateIndex
CREATE INDEX "seller_follows_sellerId_idx" ON "seller_follows"("sellerId");

-- CreateIndex
CREATE INDEX "category_follows_categoryId_idx" ON "category_follows"("categoryId");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_id_idx" ON "notifications"("userId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_userId_eventKey_key" ON "notifications"("userId", "eventKey");

-- CreateIndex
CREATE INDEX "reports_state_createdAt_idx" ON "reports"("state", "createdAt");

-- CreateIndex
CREATE INDEX "reports_listingId_idx" ON "reports"("listingId");

-- CreateIndex
CREATE INDEX "moderation_logs_targetType_targetId_createdAt_idx" ON "moderation_logs"("targetType", "targetId", "createdAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_qrAssetId_fkey" FOREIGN KEY ("qrAssetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_follows" ADD CONSTRAINT "seller_follows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_follows" ADD CONSTRAINT "seller_follows_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_follows" ADD CONSTRAINT "category_follows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_follows" ADD CONSTRAINT "category_follows_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_logs" ADD CONSTRAINT "moderation_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- PostgreSQL partial indexes enforce exclusivity independently of callers.
CREATE UNIQUE INDEX "reservations_one_accepted" ON "reservations" ("listingId") WHERE "state" = 'ACCEPTED';
CREATE UNIQUE INDEX "reservations_one_pending_per_buyer" ON "reservations" ("listingId", "buyerId") WHERE "state" = 'PENDING';
CREATE UNIQUE INDEX "reports_one_open_per_reporter" ON "reports" ("listingId", "reporterId") WHERE "state" = 'OPEN';

ALTER TABLE "users" ADD CONSTRAINT "users_normalized_email" CHECK ("email" = lower("email"));
ALTER TABLE "listings" ADD CONSTRAINT "listings_valid_price" CHECK ("price" BETWEEN 0 AND 2000000000);
ALTER TABLE "assets" ADD CONSTRAINT "assets_valid_attachment" CHECK (
    ("listingId" IS NULL AND "position" IS NULL)
    OR ("purpose" = 'LISTING' AND "listingId" IS NOT NULL AND "position" BETWEEN 0 AND 5 AND "position" IS NOT NULL)
);
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_valid_snapshot" CHECK (
    ("finalPrice" IS NULL AND "meetingAt" IS NULL AND "meetingPlace" IS NULL AND "paymentMethod" IS NULL AND "qrAssetId" IS NULL
        AND "state" NOT IN ('ACCEPTED', 'COMPLETED'))
    OR ("finalPrice" IS NOT NULL AND "finalPrice" BETWEEN 0 AND 2000000000
        AND "meetingAt" IS NOT NULL AND "meetingPlace" IS NOT NULL AND "paymentMethod" IS NOT NULL
        AND ("paymentMethod" = 'QR_MANUAL') = ("qrAssetId" IS NOT NULL)
        AND "state" IN ('ACCEPTED', 'COMPLETED', 'CANCELLED'))
);
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_completion_timestamp" CHECK (
    ("state" = 'COMPLETED') = ("completedAt" IS NOT NULL)
);
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_valid_rating" CHECK ("rating" BETWEEN 1 AND 5 AND "authorId" <> "targetId");
ALTER TABLE "seller_follows" ADD CONSTRAINT "seller_follows_no_self_follow" CHECK ("userId" <> "sellerId");
