ALTER TABLE "StudentProfile" ADD COLUMN "internshipType" TEXT NOT NULL DEFAULT 'SUPERVISIONADO';
ALTER TABLE "Tce" ADD COLUMN "internshipType" TEXT NOT NULL DEFAULT 'SUPERVISIONADO';

CREATE TABLE "InternshipReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "tceId" TEXT NOT NULL,
    "studentEnrollment" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "studentEmail" TEXT NOT NULL,
    "studentPhone" TEXT NOT NULL,
    "internshipType" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "reportStartDate" DATETIME NOT NULL,
    "reportEndDate" DATETIME NOT NULL,
    "contractStartDate" DATETIME NOT NULL,
    "contractEndDate" DATETIME NOT NULL,
    "deliveredAt" DATETIME NOT NULL,
    "hoursReported" INTEGER NOT NULL,
    "activities" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EM_ELABORACAO',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InternshipReport_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InternshipReport_tceId_fkey" FOREIGN KEY ("tceId") REFERENCES "Tce" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "InternshipReportDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "internshipReportId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InternshipReportDocument_internshipReportId_fkey" FOREIGN KEY ("internshipReportId") REFERENCES "InternshipReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "InternshipReportStatusHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "internshipReportId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InternshipReportStatusHistory_internshipReportId_fkey" FOREIGN KEY ("internshipReportId") REFERENCES "InternshipReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InternshipReportStatusHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "InternshipReport_studentId_createdAt_idx" ON "InternshipReport"("studentId", "createdAt");
CREATE INDEX "InternshipReport_status_createdAt_idx" ON "InternshipReport"("status", "createdAt");
CREATE INDEX "InternshipReport_tceId_createdAt_idx" ON "InternshipReport"("tceId", "createdAt");
CREATE INDEX "InternshipReportDocument_internshipReportId_active_idx" ON "InternshipReportDocument"("internshipReportId", "active");
CREATE INDEX "InternshipReportStatusHistory_internshipReportId_createdAt_idx" ON "InternshipReportStatusHistory"("internshipReportId", "createdAt");
