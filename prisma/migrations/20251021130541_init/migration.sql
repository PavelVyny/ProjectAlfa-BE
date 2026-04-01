-- AlterTable: rename firstName/lastName to nickname (applied directly to DB)
ALTER TABLE "public"."User" DROP COLUMN IF EXISTS "firstName";
ALTER TABLE "public"."User" DROP COLUMN IF EXISTS "lastName";
ALTER TABLE "public"."User" ADD COLUMN IF NOT EXISTS "nickname" TEXT;
