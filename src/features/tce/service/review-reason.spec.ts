import { BadRequestException } from '@nestjs/common';
import { TceStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { InternshipReportService } from '../../internship-report/service/internship-report.service';
import { TceService } from './tce.service';

const coordinator = { id: 'coordinator', roles: ['COORDINATOR'] as ('COORDINATOR')[] };

describe.each(['TCE', 'relatório'])('justificativa de %s', kind => {
  function setup() {
    const record = { status: TceStatus.EM_ANALISE, history: [{ toStatus: TceStatus.EM_ANALISE }] };
    const model = { findUnique: vi.fn().mockResolvedValue(record), update: vi.fn().mockResolvedValue({}) };
    const db: any = { tce: model, internshipReport: model };
    const service = kind === 'TCE' ? new TceService(db) : new InternshipReportService(db, {} as any);
    return { model, service };
  }

  it('aceita 1000 caracteres', async () => {
    const { model, service } = setup();
    await service.transition('id', coordinator, TceStatus.CORRECAO_NECESSARIA, 'a'.repeat(1000));
    expect(model.update).toHaveBeenCalledOnce();
  });

  it('rejeita mais de 1000 caracteres sem salvar', async () => {
    const { model, service } = setup();
    await expect(service.transition('id', coordinator, TceStatus.INDEFERIDO, 'a'.repeat(1001))).rejects.toBeInstanceOf(BadRequestException);
    expect(model.update).not.toHaveBeenCalled();
  });
});
