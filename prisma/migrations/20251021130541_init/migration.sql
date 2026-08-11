-- AlterTable: rename firstName/lastName to nickname (applied directly to DB)
ALTER TABLE "User" DROP COLUMN IF EXISTS "firstName";
ALTER TABLE "User" DROP COLUMN IF EXISTS "lastName";
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nickname" TEXT;
