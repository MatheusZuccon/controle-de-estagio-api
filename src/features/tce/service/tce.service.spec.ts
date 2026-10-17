import { BadRequestException } from '@nestjs/common';
import { TceStatus } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TceService } from './tce.service';

const actor = { id: 'user', roles: ['STUDENT'] as ('STUDENT')[], studentId: 'student' };
const pdf = { buffer: Buffer.from('pdf'), originalname: 'tce.pdf', mimetype: 'application/pdf', size: 3 };
const data = { companyName: 'Empresa', isPaid: false, internshipType: 'SUPERVISIONADO', startDate: '2026-10-16', endDate: '2026-10-17' };

function setup() {
  const db: any = {
    studentProfile: { findUnique: vi.fn().mockResolvedValue({ profileCompletedAt: new Date() }) },
    company: { upsert: vi.fn().mockResolvedValue({ id: 'company' }) },
    tce: {
      findUnique: vi.fn().mockResolvedValue({ studentId: 'student', status: TceStatus.EM_ELABORACAO, history: [] }),
      create: vi.fn().mockImplementation(({ data: value }) => value),
      update: vi.fn().mockImplementation(({ data: value }) => value),
    },
  };
  const service = new TceService(db);
  vi.spyOn(service as any, 'persist').mockResolvedValue({});
  return { db, service };
}

afterEach(() => vi.useRealTimers());

describe('validação do período do TCE', () => {
  it('aceita o dia atual de São Paulo mesmo após a mudança do dia em UTC', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-17T02:00:00Z'));
    const { service } = setup();
    const result = await service.create(actor, data, pdf);
    expect(result.startDate.toISOString()).toBe('2026-10-16T00:00:00.000Z');
    expect(result.endDate.toISOString()).toBe('2026-10-17T00:00:00.000Z');
  });

  it.each([
    ['início anterior a hoje', { startDate: '2026-10-15', endDate: '2026-10-17' }],
    ['término igual ao início', { startDate: '2026-10-16', endDate: '2026-10-16' }],
    ['término anterior ao início', { startDate: '2026-10-17', endDate: '2026-10-16' }],
    ['data inexistente', { startDate: '2026-02-30', endDate: '2026-10-17' }],
  ])('rejeita %s no cadastro e na edição antes de gravar', async (_name, period) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-17T02:00:00Z'));
    const { db, service } = setup();
    await expect(service.create(actor, { ...data, ...period }, pdf)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update('tce', actor, { ...data, ...period })).rejects.toBeInstanceOf(BadRequestException);
    expect(db.company.upsert).not.toHaveBeenCalled();
    expect(db.tce.create).not.toHaveBeenCalled();
    expect(db.tce.update).not.toHaveBeenCalled();
  });

  it('aceita a edição com início futuro e término posterior', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-17T02:00:00Z'));
    const { service } = setup();
    const result = await service.update('tce', actor, { ...data, startDate: '2026-10-17', endDate: '2026-10-18' });
    expect(result.startDate.toISOString()).toBe('2026-10-17T00:00:00.000Z');
  });
});

describe('limite do valor da bolsa', () => {
  it.each(['R$11.000,00', 'R$77.777,77', 'R$99.999,99'])('aceita %s no cadastro e na edição', async stipendAmount => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-17T02:00:00Z'));
    const { service } = setup();
    const input = { ...data, isPaid: true, stipendAmount };
    const created = await service.create(actor, input, pdf);
    const updated = await service.update('tce', actor, input);
    expect(created.stipendAmount).toBe(Number(stipendAmount.replace(/\D/g, '')));
    expect(updated.stipendAmount).toBe(created.stipendAmount);
  });

  it.each(['R$100.000,00', 'R$555.555.555,55'])('rejeita %s no cadastro e na edição', async stipendAmount => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-17T02:00:00Z'));
    const { db, service } = setup();
    const input = { ...data, isPaid: true, stipendAmount };
    await expect(service.create(actor, input, pdf)).rejects.toThrow('O valor da bolsa deve conter no máximo sete dígitos, incluindo os centavos.');
    await expect(service.update('tce', actor, input)).rejects.toThrow('O valor da bolsa deve conter no máximo sete dígitos, incluindo os centavos.');
    expect(db.tce.create).not.toHaveBeenCalled();
    expect(db.tce.update).not.toHaveBeenCalled();
  });
});
