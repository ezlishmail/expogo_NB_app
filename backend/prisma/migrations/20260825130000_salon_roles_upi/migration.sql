-- NYX SYS role model + UPI payment method.
-- Note: ALTER TYPE ... ADD VALUE runs in the migration transaction on PG 12+;
-- new values are usable once the migration commits.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'OWNER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DEVELOPER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'STAFF';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'COUNTER';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'UPI';
