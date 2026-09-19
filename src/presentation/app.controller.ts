import { Body, Controller, Get, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import argon2 from 'argon2';
import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { actorFromRequest } from '../features/tce/model/tce.model';
import { TceService } from '../features/tce/service/tce.service';
import { PrismaService } from '../infrastructure/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(private db: PrismaService) {}
  @Post('login')
  async login(@Body() data: any) {
    const user = await this.db.user.findUnique({ where: { email: data.email }, include: { roles: { include: { role: true } }, student: true } });
    if (!user || !(await argon2.verify(user.passwordHash, data.password))) throw new UnauthorizedException('E-mail ou senha inválidos.');
    const roles = user.roles.map(item => item.role.code);
    const accessToken = jwt.sign({ sub: user.id, roles, studentId: user.student?.id }, process.env.JWT_ACCESS_SECRET || 'dev-access-secret', { expiresIn: '15m' });
    return { accessToken, user: { id: user.id, email: user.email, roles, studentId: user.student?.id, profileCompleted: Boolean(user.student?.profileCompletedAt) } };
  }
}

@Controller('reports')
export class ReportsController {
  constructor(private service: TceService) {}
  @Get('tces.csv') csv(@Req() request: Request, @Query() query: any) { return this.service.list(actorFromRequest(request), query); }
}
