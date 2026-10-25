-- CreateEnum
CREATE TYPE "TceStatus" AS ENUM ('EM_ELABORACAO', 'EM_ANALISE', 'CORRECAO_NECESSARIA', 'APROVADO', 'INDEFERIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "InternshipType" AS ENUM ('SUPERVISIONADO', 'VOLUNTARIO', 'OUTRO');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('TCE_PDF', 'STUDENT_PHOTO');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('FUNDAMENTAL_INCOMPLETO', 'FUNDAMENTAL_COMPLETO', 'MEDIO_INCOMPLETO', 'MEDIO_COMPLETO', 'SUPERIOR_INCOMPLETO', 'SUPERIOR_COMPLETO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "refreshTokenHash" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enrollment" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "photoKey" TEXT,
    "photoMimeType" TEXT,
    "photoOriginalName" TEXT,
    "socialName" TEXT,
    "birthDate" TIMESTAMP(3),
    "gender" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "neighborhood" TEXT,
    "city" TEXT,
    "state" TEXT,
    "course" TEXT,
    "identity" TEXT,
    "cpf" TEXT,
    "academicPeriod" TEXT,
    "educationLevel" "EducationLevel",
    "internshipType" "InternshipType" NOT NULL DEFAULT 'SUPERVISIONADO',
    "profileCompletedAt" TIMESTAMP(3),

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoordinatorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "CoordinatorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tce" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "studentEnrollment" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "studentEmail" TEXT NOT NULL,
    "studentPhone" TEXT NOT NULL,
    "studentPhotoKey" TEXT,
    "isPaid" BOOLEAN NOT NULL,
    "stipendAmount" INTEGER,
    "internshipType" "InternshipType" NOT NULL DEFAULT 'SUPERVISIONADO',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "TceStatus" NOT NULL DEFAULT 'EM_ELABORACAO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternshipReport" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "tceId" TEXT NOT NULL,
    "studentEnrollment" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "studentEmail" TEXT NOT NULL,
    "studentPhone" TEXT NOT NULL,
    "internshipType" "InternshipType" NOT NULL,
    "companyName" TEXT NOT NULL,
    "reportStartDate" TIMESTAMP(3) NOT NULL,
    "reportEndDate" TIMESTAMP(3) NOT NULL,
    "contractStartDate" TIMESTAMP(3) NOT NULL,
    "contractEndDate" TIMESTAMP(3) NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL,
    "hoursReported" INTEGER NOT NULL,
    "activities" TEXT NOT NULL,
    "status" "TceStatus" NOT NULL DEFAULT 'EM_ELABORACAO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternshipReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternshipReportDocument" (
    "id" TEXT NOT NULL,
    "internshipReportId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternshipReportDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InternshipReportStatusHistory" (
    "id" TEXT NOT NULL,
    "internshipReportId" TEXT NOT NULL,
    "fromStatus" "TceStatus",
    "toStatus" "TceStatus" NOT NULL,
    "reason" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternshipReportStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TceDocument" (
    "id" TEXT NOT NULL,
    "tceId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL DEFAULT 'TCE_PDF',
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TceStatusHistory" (
    "id" TEXT NOT NULL,
    "tceId" TEXT NOT NULL,
    "fromStatus" "TceStatus",
    "toStatus" "TceStatus" NOT NULL,
    "reason" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TceStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "tceId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "ip" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_enrollment_key" ON "StudentProfile"("enrollment");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_cpf_key" ON "StudentProfile"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "CoordinatorProfile_userId_key" ON "CoordinatorProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_normalizedName_key" ON "Company"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "Tce_number_key" ON "Tce"("number");

-- CreateIndex
CREATE INDEX "Tce_status_createdAt_idx" ON "Tce"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Tce_studentId_createdAt_idx" ON "Tce"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "InternshipReport_studentId_createdAt_idx" ON "InternshipReport"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "InternshipReport_status_createdAt_idx" ON "InternshipReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "InternshipReport_tceId_createdAt_idx" ON "InternshipReport"("tceId", "createdAt");

-- CreateIndex
CREATE INDEX "InternshipReportDocument_internshipReportId_active_idx" ON "InternshipReportDocument"("internshipReportId", "active");

-- CreateIndex
CREATE INDEX "InternshipReportStatusHistory_internshipReportId_createdAt_idx" ON "InternshipReportStatusHistory"("internshipReportId", "createdAt");

-- CreateIndex
CREATE INDEX "TceDocument_tceId_type_active_idx" ON "TceDocument"("tceId", "type", "active");

-- CreateIndex
CREATE INDEX "TceStatusHistory_tceId_createdAt_idx" ON "TceStatusHistory"("tceId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_createdAt_idx" ON "AuditLog"("entity", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoordinatorProfile" ADD CONSTRAINT "CoordinatorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tce" ADD CONSTRAINT "Tce_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tce" ADD CONSTRAINT "Tce_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipReport" ADD CONSTRAINT "InternshipReport_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipReport" ADD CONSTRAINT "InternshipReport_tceId_fkey" FOREIGN KEY ("tceId") REFERENCES "Tce"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipReportDocument" ADD CONSTRAINT "InternshipReportDocument_internshipReportId_fkey" FOREIGN KEY ("internshipReportId") REFERENCES "InternshipReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipReportStatusHistory" ADD CONSTRAINT "InternshipReportStatusHistory_internshipReportId_fkey" FOREIGN KEY ("internshipReportId") REFERENCES "InternshipReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternshipReportStatusHistory" ADD CONSTRAINT "InternshipReportStatusHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TceDocument" ADD CONSTRAINT "TceDocument_tceId_fkey" FOREIGN KEY ("tceId") REFERENCES "Tce"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TceStatusHistory" ADD CONSTRAINT "TceStatusHistory_tceId_fkey" FOREIGN KEY ("tceId") REFERENCES "Tce"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TceStatusHistory" ADD CONSTRAINT "TceStatusHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tceId_fkey" FOREIGN KEY ("tceId") REFERENCES "Tce"("id") ON DELETE SET NULL ON UPDATE CASCADE;

