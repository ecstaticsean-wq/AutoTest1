-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('SCHEDULED', 'PUBLISHED', 'FAILED');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "qstashMessageId" TEXT,
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "status" "PostStatus" NOT NULL DEFAULT 'PUBLISHED';
