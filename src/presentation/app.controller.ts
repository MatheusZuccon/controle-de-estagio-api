import { Body, Controller, Get, Param, Patch, Post, Query, Req, StreamableFile, UnauthorizedException, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { TceStatus } from '@prisma/client';
import argon2 from 'argon2';
import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { TceService, Actor } from '../application/tce.service';
import { PrismaService } from '../infrastructure/prisma.service';

type UploadedTceFiles = { document?: Express.Multer.File[]; photo?: Express.Multer.File[] };

function actor(request: Request): Actor {
  try {
    const payload: any = jwt.verify(request.headers.authorization?.replace('Bearer ', '') || '', process.env.JWT_ACCESS_SECRET || 'dev-access-secret');
    return { id: payload.sub, roles: payload.roles, studentId: payload.studentId };
  } catch {
    throw new UnauthorizedException('Sessão inválida ou expirada.');
  }
}

@Controller('auth')
export class AuthController {
  constructor(private db: PrismaService) {}
  @Post('login')
  async login(@Body() data: any) {
    const user = await this.db.user.findUnique({ where: { email: data.email }, include: { roles: { include: { role: true } }, student: true } });
    if (!user || !(await argon2.verify(user.passwordHash, data.password))) throw new UnauthorizedException('E-mail ou senha inválidos.');
    const roles = user.roles.map(item => item.role.code);
    const accessToken = jwt.sign({ sub: user.id, roles, studentId: user.student?.id }, process.env.JWT_ACCESS_SECRET || 'dev-access-secret', { expiresIn: '15m' });
    return { accessToken, user: { id: user.id, email: user.email, roles, studentId: user.student?.id } };
  }
}

@Controller('tces')
export class TcesController {
  constructor(private service: TceService) {}
  @Get() list(@Req() request: Request, @Query() query: any) { return this.service.list(actor(request), query); }
  @Post()
  @UseInterceptors(FileFieldsInterceptor([{ name: 'document', maxCount: 1 }, { name: 'photo', maxCount: 1 }]))
  create(@Req() request: Request, @Body() data: any, @UploadedFiles() files: UploadedTceFiles) { return this.service.create(actor(request), data, files?.document?.[0], files?.photo?.[0]); }
  @Get(':id') detail(@Req() request: Request, @Param('id') id: string) { return this.service.detail(id, actor(request)); }
  @Get(':id/documents/:documentId/download')
  async download(@Req() request: Request, @Param('id') id: string, @Param('documentId') documentId: string) {
    const result = await this.service.download(id, documentId, actor(request));
    return new StreamableFile(result.buffer, { type: result.document.mimeType, disposition: `attachment; filename="${encodeURIComponent(result.document.originalName)}"` });
  }
  @Patch(':id')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'document', maxCount: 1 }, { name: 'photo', maxCount: 1 }]))
  update(@Req() request: Request, @Param('id') id: string, @Body() data: any, @UploadedFiles() files: UploadedTceFiles) { return this.service.update(id, actor(request), data, files?.document?.[0], files?.photo?.[0]); }
  @Post(':id/submit') submit(@Req() request: Request, @Param('id') id: string) { return this.service.transition(id, actor(request), TceStatus.EM_ANALISE); }
  @Post(':id/cancel') cancel(@Req() request: Request, @Param('id') id: string) { return this.service.transition(id, actor(request), TceStatus.CANCELADO); }
  @Post(':id/review') review(@Req() request: Request, @Param('id') id: string, @Body() data: any) { return this.service.transition(id, actor(request), ({ APPROVE: TceStatus.APROVADO, REQUEST_CORRECTION: TceStatus.CORRECAO_NECESSARIA, REJECT: TceStatus.INDEFERIDO } as any)[data.decision], data.reason); }
  @Get(':id/history') history(@Req() request: Request, @Param('id') id: string) { return this.service.history(id, actor(request)); }
}

@Controller('reports')
export class ReportsController {
  constructor(private service: TceService) {}
  @Get('tces.csv') csv(@Req() request: Request, @Query() query: any) { return this.service.list(actor(request), query); }
}
