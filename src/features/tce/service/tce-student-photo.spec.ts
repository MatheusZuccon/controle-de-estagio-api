import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TceStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'fs/promises';
import { TceService } from './tce.service';

vi.mock('fs/promises', async (original) => ({ ...(await original<typeof import('fs/promises')>()), readFile: vi.fn() }));

describe('foto do estagiário no TCE', () => {
  const student = { id: 'user', roles: ['STUDENT'] as ('STUDENT')[], studentId: 'student' };
  const coordinator = { id: 'coordinator', roles: ['COORDINATOR'] as ('COORDINATOR')[] };
  const profile = { photoKey: 'photo.png', photoMimeType: 'image/png', photoOriginalName: 'foto.png' };
  let db: any;
  let service: TceService;

  beforeEach(() => {
    db = {
      studentProfile: { findUnique: vi.fn().mockImplementation(({ select }) => select?.photoKey ? profile : { profileCompletedAt: new Date() }) },
      tce: { findUnique: vi.fn().mockResolvedValue({ studentId: 'student', history: [{ toStatus: TceStatus.EM_ANALISE }] }) },
    };
    service = new TceService(db);
    vi.mocked(readFile).mockResolvedValue(Buffer.from('image'));
  });

  it.each([student, coordinator])('retorna a foto do cadastro para quem pode acessar o TCE', async actor => {
    await expect(service.studentPhoto('tce', actor)).resolves.toMatchObject({ buffer: Buffer.from('image'), mimeType: 'image/png', originalName: 'foto.png' });
    expect(db.studentProfile.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'student' }, select: expect.objectContaining({ photoKey: true }) }));
  });

  it('não permite que outro aluno acesse a foto', async () => {
    await expect(service.studentPhoto('tce', { ...student, studentId: 'other' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.studentProfile.findUnique).not.toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ photoKey: true }) }));
  });

  it('não permite que o coordenador acesse um TCE ainda não enviado', async () => {
    db.tce.findUnique.mockResolvedValue({ studentId: 'student', history: [] });
    await expect(service.studentPhoto('tce', coordinator)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('informa quando não há foto no cadastro', async () => {
    db.studentProfile.findUnique.mockImplementation(({ select }: any) => select?.photoKey ? {} : { profileCompletedAt: new Date() });
    await expect(service.studentPhoto('tce', student)).rejects.toBeInstanceOf(NotFoundException);
  });
});
