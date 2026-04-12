-- CreateTable
CREATE TABLE "AdminRoleChangeRequest" (
    "id" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "previousRole" "Role" NOT NULL,
    "requestedRole" "Role" NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminRoleChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminRoleChangeRequest_targetUserId_key" ON "AdminRoleChangeRequest"("targetUserId");

-- CreateIndex
CREATE INDEX "AdminRoleChangeRequest_requestedByUserId_idx" ON "AdminRoleChangeRequest"("requestedByUserId");

-- AddForeignKey
ALTER TABLE "AdminRoleChangeRequest" ADD CONSTRAINT "AdminRoleChangeRequest_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminRoleChangeRequest" ADD CONSTRAINT "AdminRoleChangeRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
