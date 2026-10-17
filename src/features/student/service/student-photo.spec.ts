import { mkdtemp, rmdir, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { StudentService } from './student.service';

describe('foto do aluno', () => {
  it('salva a foto e a recupera ao carregar o cadastro novamente', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'estagio-photo-'));
    const previousDirectory = process.env.UPLOAD_DIR;
    process.env.UPLOAD_DIR = directory;
    let profile: any = { id: 'student', profileCompletedAt: new Date(), photoKey: null };
    const db: any = { studentProfile: {
      findUnique: vi.fn(async () => profile),
      update: vi.fn(async ({ data }) => { profile = { ...profile, ...data }; return profile; }),
    } };
    const service = new StudentService(db);
    const actor = { id: 'user', roles: ['STUDENT'] as ('STUDENT')[], studentId: 'student' };
    const data = { name: 'Ana Silva', enrollment: '2023100101', phone: '(24) 99999-0000', birthDate: '2000-01-01', address: 'Rua das Flores, 10', postalCode: '25680-000', neighborhood: 'Centro', city: 'Petrópolis', state: 'RJ', course: 'Tecnologia da Informação e Comunicação - TIC', identity: '1234567', cpf: '529.982.247-25', academicPeriod: '1', educationLevel: 'SUPERIOR_INCOMPLETO', internshipType: 'SUPERVISIONADO' };
    const buffer = Buffer.from('conteúdo da imagem');
    try {
      const saved = await service.update(actor, data, { buffer, originalname: 'foto.png', mimetype: 'image/png', size: buffer.length });
      expect(saved.photoAvailable).toBe(true);
      expect((await service.me(actor)).photoAvailable).toBe(true);
      const photo = await service.photo(actor);
      expect(photo.buffer).toEqual(buffer);
      expect(photo.mimeType).toBe('image/png');
      await service.update(actor, data);
      expect((await service.photo(actor)).buffer).toEqual(buffer);
    } finally {
      if (profile.photoKey) await unlink(join(directory, profile.photoKey));
      await rmdir(directory);
      if (previousDirectory === undefined) delete process.env.UPLOAD_DIR;
      else process.env.UPLOAD_DIR = previousDirectory;
    }
  });
});
