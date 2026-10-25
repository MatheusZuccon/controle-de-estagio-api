import { UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { describe, expect, it, vi } from 'vitest';
import { AuthController } from './app.controller';

describe('AuthController.me', () => {
  const request = (roles: string[]) => ({ headers: { authorization: `Bearer ${jwt.sign({ sub: 'user-1', roles }, process.env.JWT_ACCESS_SECRET || 'dev-access-secret')}` } }) as any;

  it('usa o nome social do aluno quando preenchido', async () => {
    const db: any = { user: { findUnique: vi.fn().mockResolvedValue({ student: { name: 'Nome civil', socialName: 'Nome social' }, coordinator: null }) } };
    await expect(new AuthController(db).me(request(['STUDENT']))).resolves.toEqual({ name: 'Nome social' });
  });

  it('retorna o nome do coordenador', async () => {
    const db: any = { user: { findUnique: vi.fn().mockResolvedValue({ student: null, coordinator: { name: 'Coordenação' } }) } };
    await expect(new AuthController(db).me(request(['COORDINATOR']))).resolves.toEqual({ name: 'Coordenação' });
  });

  it('rejeita uma sessão inválida', async () => {
    const db: any = { user: { findUnique: vi.fn() } };
    await expect(new AuthController(db).me({ headers: {} } as any)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
});
