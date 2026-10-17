import { BadRequestException } from '@nestjs/common';
import { TceStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { InternshipReportService } from './internship-report.service';

const actor = { id: 'user', roles: ['STUDENT'] as ('STUDENT')[], studentId: 'student' };
const data = { tceId: 'tce', internshipType: 'SUPERVISIONADO', reportStartDate: '2026-01-10', reportEndDate: '2026-02-20', deliveredAt: '2026-03-01', hoursReported: '80', activities: 'Atividades realizadas' };

function setup() {
  const db: any = {
    studentProfile: { findUnique: vi.fn().mockResolvedValue({ id: 'student', profileCompletedAt: new Date(), enrollment: '123', name: 'Aluno', email: 'a@example.com', phone: '123' }) },
    tce: { findUnique: vi.fn().mockResolvedValue({ studentId: 'student', status: TceStatus.APROVADO, startDate: new Date('2026-01-10T00:00:00Z'), endDate: new Date('2026-02-20T00:00:00Z'), company: { name: 'Empresa' } }), findMany: vi.fn().mockResolvedValue([]) },
    internshipReport: {
      findUnique: vi.fn().mockResolvedValue({ studentId: 'student', status: TceStatus.EM_ELABORACAO, tceId: 'tce', history: [] }),
      create: vi.fn().mockImplementation(({ data: value }) => value),
      update: vi.fn().mockImplementation(({ data: value }) => value),
    },
  };
  return { db, service: new InternshipReportService(db, {} as any) };
}

describe('TCEs disponíveis para relatórios', () => {
  it('consulta somente TCEs aprovados do aluno', async () => {
    const { db, service } = setup();
    await service.formData(actor);
    expect(db.tce.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { studentId: 'student', status: TceStatus.APROVADO } }));
  });

  it.each([TceStatus.EM_ELABORACAO, TceStatus.EM_ANALISE, TceStatus.CORRECAO_NECESSARIA, TceStatus.INDEFERIDO, TceStatus.CANCELADO])('rejeita TCE com status %s ao cadastrar e editar', async status => {
    const { db, service } = setup();
    db.tce.findUnique.mockResolvedValue({ studentId: 'student', status });
    await expect(service.create(actor, data)).rejects.toThrow('Selecione um TCE aprovado');
    await expect(service.update('report', actor, data)).rejects.toThrow('Selecione um TCE aprovado');
    expect(db.internshipReport.create).not.toHaveBeenCalled();
    expect(db.internshipReport.update).not.toHaveBeenCalled();
  });
});

describe('período do relatório de estágio', () => {
  it.each([
    ['ambos os limites', '2026-01-10', '2026-02-20'],
    ['um único dia no início', '2026-01-10', '2026-01-10'],
    ['um único dia no fim', '2026-02-20', '2026-02-20'],
  ])('aceita %s no cadastro e na edição', async (_name, start, end) => {
    const { db, service } = setup();
    const input = { ...data, reportStartDate: start, reportEndDate: end };
    await service.create(actor, input);
    await service.update('report', actor, input);
    expect(db.internshipReport.create).toHaveBeenCalledOnce();
    expect(db.internshipReport.update).toHaveBeenCalledOnce();
  });

  it.each([
    ['início anterior ao TCE', '2026-01-09', '2026-01-10'],
    ['término posterior ao TCE', '2026-02-20', '2026-02-21'],
    ['início e término após o TCE', '2026-02-21', '2026-02-22'],
    ['início e término antes do TCE', '2026-01-08', '2026-01-09'],
    ['término anterior ao início', '2026-02-01', '2026-01-31'],
  ])('rejeita %s no cadastro e na edição', async (_name, start, end) => {
    const { db, service } = setup();
    const input = { ...data, reportStartDate: start, reportEndDate: end };
    await expect(service.create(actor, input)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update('report', actor, input)).rejects.toBeInstanceOf(BadRequestException);
    expect(db.internshipReport.create).not.toHaveBeenCalled();
    expect(db.internshipReport.update).not.toHaveBeenCalled();
  });
});
