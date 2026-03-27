/*
  Warnings:

  - You are about to drop the column `wxOrderId` on the `Order` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Order_wxOrderId_key";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "wxOrderId",
ADD COLUMN     "note" TEXT,
ADD COLUMN     "transferNo" TEXT;
