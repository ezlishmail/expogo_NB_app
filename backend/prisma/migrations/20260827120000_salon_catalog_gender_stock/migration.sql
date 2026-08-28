-- Real-catalog import support: staff/service metadata, gender, COD charge,
-- and the manual stock-adjustment audit ledger.

-- Gender enum: staff.gender (own gender, drives the male/female stylist filter)
-- and service.forGender (target clientele; NULL = everyone).
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- Services: grouping category + target clientele.
ALTER TABLE "services" ADD COLUMN "category" TEXT;
ALTER TABLE "services" ADD COLUMN "forGender" "Gender";

-- Staff: own gender, profile photo, and specialties.
ALTER TABLE "staff" ADD COLUMN "gender" "Gender";
ALTER TABLE "staff" ADD COLUMN "photoUrl" TEXT;
ALTER TABLE "staff" ADD COLUMN "specialties" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Orders: owner-configurable COD/handling charge, folded into the total.
ALTER TABLE "orders" ADD COLUMN "codChargeCents" INTEGER NOT NULL DEFAULT 0;

-- Manual stock-change audit ledger (every add/remove carries a reason + author).
CREATE TABLE "stock_adjustments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stock_adjustments_tenantId_createdAt_idx" ON "stock_adjustments"("tenantId", "createdAt");
CREATE INDEX "stock_adjustments_productId_idx" ON "stock_adjustments"("productId");

ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
