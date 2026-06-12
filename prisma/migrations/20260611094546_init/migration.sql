-- CreateEnum
CREATE TYPE "ReplyJobStatus" AS ENUM ('PENDING', 'ACTIVE', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "ReplyStatus" AS ENUM ('PENDING', 'REPLIED', 'FAILED');

-- CreateEnum
CREATE TYPE "SnapshotPeriod" AS ENUM ('DAY_1', 'DAY_3', 'DAY_7', 'DAY_30');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'BASIC', 'PRO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "hashedPassword" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreadsToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "threadsUserId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThreadsToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGeminiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGeminiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "stripeCustomerId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "salesUrl" TEXT NOT NULL,
    "generatedText" TEXT NOT NULL,
    "postFormat" TEXT NOT NULL,
    "threadsPostId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "replyWindowEnds" TIMESTAMP(3),
    "replyJobStatus" "ReplyJobStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplyTracking" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "threadsCommentId" TEXT NOT NULL,
    "commentText" TEXT NOT NULL,
    "replyText" TEXT,
    "repliedAt" TIMESTAMP(3),
    "status" "ReplyStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplyTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsSnapshot" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "snapshotPeriod" "SnapshotPeriod" NOT NULL,
    "reach" INTEGER,
    "impressions" INTEGER,
    "replies" INTEGER,
    "reposts" INTEGER,
    "likes" INTEGER,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ThreadsToken_userId_key" ON "ThreadsToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserGeminiKey_userId_key" ON "UserGeminiKey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Post_threadsPostId_key" ON "Post"("threadsPostId");

-- CreateIndex
CREATE UNIQUE INDEX "ReplyTracking_threadsCommentId_key" ON "ReplyTracking"("threadsCommentId");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsSnapshot_postId_snapshotPeriod_key" ON "AnalyticsSnapshot"("postId", "snapshotPeriod");

-- AddForeignKey
ALTER TABLE "ThreadsToken" ADD CONSTRAINT "ThreadsToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGeminiKey" ADD CONSTRAINT "UserGeminiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyTracking" ADD CONSTRAINT "ReplyTracking_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsSnapshot" ADD CONSTRAINT "AnalyticsSnapshot_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
