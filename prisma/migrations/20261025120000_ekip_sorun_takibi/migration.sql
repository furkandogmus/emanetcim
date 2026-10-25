-- Ekip içi sorun takibi tabloları (TeamIssue, TeamIssueImage, TeamIssueEvent).
CREATE TABLE "TeamIssue" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamIssue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamIssueImage" (
    "id" TEXT NOT NULL,
    "issueId" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamIssueImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamIssueEvent" (
    "id" TEXT NOT NULL,
    "issueId" INTEGER NOT NULL,
    "userName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamIssueEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TeamIssue_createdAt_idx" ON "TeamIssue"("createdAt");
CREATE INDEX "TeamIssue_status_idx" ON "TeamIssue"("status");
CREATE INDEX "TeamIssueImage_issueId_idx" ON "TeamIssueImage"("issueId");
CREATE INDEX "TeamIssueEvent_issueId_idx" ON "TeamIssueEvent"("issueId");

ALTER TABLE "TeamIssueImage" ADD CONSTRAINT "TeamIssueImage_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "TeamIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamIssueEvent" ADD CONSTRAINT "TeamIssueEvent_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "TeamIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
