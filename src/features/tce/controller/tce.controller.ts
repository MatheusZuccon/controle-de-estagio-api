import { Body, Controller, Get, Param, Patch, Post, Query, Req, StreamableFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { TceStatus } from '@prisma/client';
import { Request } from 'express';
import { actorFromRequest, UploadedTceFiles } from '../model/tce.model';
import { TceService } from '../service/tce.service';

@Controller('tces')
export class TcesController {
  constructor(private service: TceService) {}
  @Get() list(@Req() request: Request, @Query() query: any) { return this.service.list(actorFromRequest(request), query); }
  @Post()
  @UseInterceptors(FileFieldsInterceptor([{ name: 'document', maxCount: 1 }, { name: 'photo', maxCount: 1 }]))
  create(@Req() request: Request, @Body() data: any, @UploadedFiles() files: UploadedTceFiles) { return this.service.create(actorFromRequest(request), data, files?.document?.[0], files?.photo?.[0]); }
  @Get(':id') detail(@Req() request: Request, @Param('id') id: string) { return this.service.detail(id, actorFromRequest(request)); }
  @Get(':id/documents/:documentId/download')
  async download(@Req() request: Request, @Param('id') id: string, @Param('documentId') documentId: string) {
    const result = await this.service.download(id, documentId, actorFromRequest(request));
    return new StreamableFile(result.buffer, { type: result.document.mimeType, disposition: `attachment; filename="${encodeURIComponent(result.document.originalName)}"` });
  }
  @Patch(':id')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'document', maxCount: 1 }, { name: 'photo', maxCount: 1 }]))
  update(@Req() request: Request, @Param('id') id: string, @Body() data: any, @UploadedFiles() files: UploadedTceFiles) { return this.service.update(id, actorFromRequest(request), data, files?.document?.[0], files?.photo?.[0]); }
  @Post(':id/submit') submit(@Req() request: Request, @Param('id') id: string) { return this.service.transition(id, actorFromRequest(request), TceStatus.EM_ANALISE); }
  @Post(':id/cancel') cancel(@Req() request: Request, @Param('id') id: string) { return this.service.transition(id, actorFromRequest(request), TceStatus.CANCELADO); }
  @Post(':id/review') review(@Req() request: Request, @Param('id') id: string, @Body() data: any) { return this.service.transition(id, actorFromRequest(request), ({ APPROVE: TceStatus.APROVADO, REQUEST_CORRECTION: TceStatus.CORRECAO_NECESSARIA, REJECT: TceStatus.INDEFERIDO } as any)[data.decision], data.reason); }
  @Get(':id/history') history(@Req() request: Request, @Param('id') id: string) { return this.service.history(id, actorFromRequest(request)); }
}