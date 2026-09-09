import { UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import jwt from 'jsonwebtoken';

export type RoleCode = 'COORDINATOR' | 'STUDENT';
export type Actor = { id: string; roles: RoleCode[]; studentId?: string };
export type UploadedTceFiles = { document?: Express.Multer.File[]; photo?: Express.Multer.File[] };

export function actorFromRequest(request: Request): Actor {
  try {
    const payload: any = jwt.verify(
      request.headers.authorization?.replace('Bearer ', '') || '',
      process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
    );
    return { id: payload.sub, roles: payload.roles, studentId: payload.studentId };
  } catch {
    throw new UnauthorizedException('Sessão inválida ou expirada.');
  }
}