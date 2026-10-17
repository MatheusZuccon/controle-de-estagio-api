import { ForbiddenException } from '@nestjs/common';
import { TceStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { InternshipReportService } from './internship-report.service';

const actor = { id: 'user', roles: ['STUDENT'] as ('STUDENT')[], studentId: 'student' };
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
function setup() {
  const db: any = {
    studentProfile: { findUnique: vi.fn().mockResolvedValue({ id: 'student', profileCompletedAt: new Date() }) },
    tce: { findMany: vi.fn().mockResolvedValue([
      { id: 'a', number: '123', status: TceStatus.APROVADO, startDate: date('2026-01-01'), endDate: date('2026-01-10'), company: { name: 'Empresa' } },
      { id: 'b', number: '456', status: TceStatus.EM_ELABORACAO, startDate: date('2026-02-01'), endDate: date('2026-02-03'), company: { name: 'Outra empresa' } },
    ]) },
    internshipReport: { findMany: vi.fn().mockResolvedValue([
      { tceId: 'a', hoursReported: 100, reportStartDate: date('2025-12-30'), reportEndDate: date('2026-01-02') },
      { tceId: 'a', hoursReported: 60, reportStartDate: date('2026-01-02'), reportEndDate: date('2026-01-04') },
      { tceId: 'a', hoursReported: 40, reportStartDate: date('2026-01-07'), reportEndDate: date('2026-01-08') },
      { tceId: 'a', hoursReported: 10, reportStartDate: date('2026-01-09'), reportEndDate: date('2026-01-12') },
    ]) },
    $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
  };
  return { db, service: new InternshipReportService(db, {} as any) };
}

describe('horas e períodos relatados por TCE', () => {
  it('soma relatórios aprovados, une períodos sobrepostos e mostra lacunas dentro do TCE', async () => {
    const { db, service } = setup();
    const result = await service.reportedHours(actor);
    expect(result).toEqual([
      { id: 'a', number: '123', status: 'APROVADO', company: 'Empresa', hoursReported: 210, startDate: '2026-01-01', endDate: '2026-01-10', totalDays: 10, coveredDays: 8, uncoveredPeriods: [{ startDate: '2026-01-05', endDate: '2026-01-06' }] },
      { id: 'b', number: '456', status: 'EM_ELABORACAO', company: 'Outra empresa', hoursReported: 0, startDate: '2026-02-01', endDate: '2026-02-03', totalDays: 3, coveredDays: 0, uncoveredPeriods: [{ startDate: '2026-02-01', endDate: '2026-02-03' }] },
    ]);
    expect(db.tce.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { studentId: 'student' } }));
    expect(db.internshipReport.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { studentId: 'student', status: TceStatus.APROVADO } }));
  });

  it('retorna lista vazia quando o aluno não tem TCEs', async () => {
    const { db, service } = setup();
    db.tce.findMany.mockResolvedValue([]);
    await expect(service.reportedHours(actor)).resolves.toEqual([]);
  });

  it('não permite acesso sem perfil de aluno completo', async () => {
    const { db, service } = setup();
    db.studentProfile.findUnique.mockResolvedValue({ id: 'student', profileCompletedAt: null });
    await expect(service.reportedHours(actor)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.reportedHours({ id: 'coordinator', roles: ['COORDINATOR'] })).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.tce.findMany).not.toHaveBeenCalled();
    expect(db.internshipReport.findMany).not.toHaveBeenCalled();
  });
});
