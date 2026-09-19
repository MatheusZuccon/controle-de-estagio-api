import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { StudentService } from './student.service';

const actor = { id: 'user-1', roles: ['STUDENT'] as ('STUDENT')[], studentId: 'student-1' };
const validData = {
  name: 'Ana Silva', enrollment: '2023100101', phone: '(24) 99999-0000', socialName: '', birthDate: '2000-01-01', gender: '',
  address: 'Rua das Flores, 10', postalCode: '25680-000', neighborhood: 'Centro', city: 'Petrópolis', state: 'rj',
  course: 'Tecnologia da Informação e Comunicação - TIC', identity: '1234567', cpf: '529.982.247-25', academicPeriod: '1', educationLevel: 'SUPERIOR_INCOMPLETO',
};

describe('StudentService', () => {
  it('rejeita CPF inválido', async () => {
    const db: any = { studentProfile: { findUnique: vi.fn().mockResolvedValue({ id: 'student-1', profileCompletedAt: null }) } };
    await expect(new StudentService(db).update(actor, { ...validData, cpf: '111.111.111-11' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita aluno menor de 16 anos', async () => {
    const db: any = { studentProfile: { findUnique: vi.fn().mockResolvedValue({ id: 'student-1', profileCompletedAt: null }) } };
    const birthDate = new Date(); birthDate.setFullYear(birthDate.getFullYear() - 15);
    await expect(new StudentService(db).update(actor, { ...validData, birthDate: birthDate.toISOString().slice(0, 10) })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('completa o perfil com CPF normalizado', async () => {
    const db: any = { studentProfile: { findUnique: vi.fn().mockResolvedValue({ id: 'student-1', profileCompletedAt: null }), update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'student-1', ...data })) } };
    const result = await new StudentService(db).update(actor, validData);
    expect(db.studentProfile.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ cpf: '52998224725', profileCompletedAt: expect.any(Date) }) }));
    expect(result.profileCompleted).toBe(true);
  });
});
