import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { TceService } from './tce.service';
import { InternshipReportService } from '../../internship-report/service/internship-report.service';

const actor = { id: 'user', roles: ['STUDENT'] as ('STUDENT')[], studentId: 'student' };

function setup() {
  const table = () => ({ count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) });
  const db: any = {
    studentProfile: { findUnique: vi.fn().mockResolvedValue({ id: 'student', profileCompletedAt: new Date() }) },
    tce: table(), internshipReport: table(),
    $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
  };
  return { db, tces: new TceService(db), reports: new InternshipReportService(db, {} as any) };
}

describe('ordenação das listagens', () => {
  it('ordena TCEs pela empresa antes da paginação, preservando filtro e aluno', async () => {
    const { db, tces } = setup();
    await tces.list(actor, { sortBy: 'company', sortDirection: 'asc', page: '2', pageSize: '5', status: 'APROVADO' });
    expect(db.tce.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { studentId: 'student', status: 'APROVADO' }, skip: 5, take: 5,
      orderBy: [{ company: { name: 'asc' } }, { id: 'asc' }],
    }));
  });

  it('ordena períodos de relatórios por início e fim antes da paginação', async () => {
    const { db, reports } = setup();
    await reports.list(actor, { sortBy: 'reportStartDate', sortDirection: 'desc', page: '3', pageSize: '5', company: 'EDS' });
    expect(db.internshipReport.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { studentId: 'student', companyName: { contains: 'EDS' } }, skip: 10, take: 5,
      orderBy: [{ reportStartDate: 'desc' }, { reportEndDate: 'desc' }, { id: 'asc' }],
    }));
  });

  it('mantém a data de criação decrescente como ordem padrão', async () => {
    const { db, tces, reports } = setup();
    await tces.list(actor, {});
    await reports.list(actor, {});
    expect(db.tce.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] }));
    expect(db.internshipReport.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] }));
  });

  it.each([{ sortBy: 'studentId' }, { sortBy: 'company', sortDirection: 'invalid' }, { sortBy: ['status'] }])('rejeita parâmetros de ordenação inválidos: %j', async query => {
    const { db, tces, reports } = setup();
    await expect(tces.list(actor, query)).rejects.toBeInstanceOf(BadRequestException);
    await expect(reports.list(actor, query)).rejects.toBeInstanceOf(BadRequestException);
    expect(db.tce.findMany).not.toHaveBeenCalled();
    expect(db.internshipReport.findMany).not.toHaveBeenCalled();
  });
});
