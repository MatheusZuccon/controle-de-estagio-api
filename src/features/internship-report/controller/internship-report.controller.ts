import { Body, Controller, Get, Param, Patch, Post, Query, Req, StreamableFile } from '@nestjs/common';
import { TceStatus } from '@prisma/client';
import { Request } from 'express';
import { actorFromRequest } from '../../tce/model/tce.model';
import { InternshipReportService } from '../service/internship-report.service';

@Controller('internship-reports')
export class InternshipReportsController {
  constructor(private service: InternshipReportService) {}

  @Get('form-data') formData(@Req() request: Request) { return this.service.formData(actorFromRequest(request)); }
  @Get() list(@Req() request: Request, @Query() query: any) { return this.service.list(actorFromRequest(request), query); }
  @Post() create(@Req() request: Request, @Body() data: any) { return this.service.create(actorFromRequest(request), data); }
  @Get(':id') detail(@Req() request: Request, @Param('id') id: string) { return this.service.detail(id, actorFromRequest(request)); }
  @Patch(':id') update(@Req() request: Request, @Param('id') id: string, @Body() data: any) { return this.service.update(id, actorFromRequest(request), data); }
  @Post(':id/generate-document') generate(@Req() request: Request, @Param('id') id: string) { return this.service.generateDocument(id, actorFromRequest(request)); }
  @Post(':id/submit') submit(@Req() request: Request, @Param('id') id: string) { return this.service.transition(id, actorFromRequest(request), TceStatus.EM_ANALISE); }
  @Post(':id/cancel') cancel(@Req() request: Request, @Param('id') id: string) { return this.service.transition(id, actorFromRequest(request), TceStatus.CANCELADO); }
  @Post(':id/review') review(@Req() request: Request, @Param('id') id: string, @Body() data: any) { return this.service.transition(id, actorFromRequest(request), ({ APPROVE: TceStatus.APROVADO, REQUEST_CORRECTION: TceStatus.CORRECAO_NECESSARIA, REJECT: TceStatus.INDEFERIDO } as any)[data.decision], data.reason); }
  @Get(':id/history') history(@Req() request: Request, @Param('id') id: string) { return this.service.history(id, actorFromRequest(request)); }
  @Get(':id/documents/:documentId/download')
  async download(@Req() request: Request, @Param('id') id: string, @Param('documentId') documentId: string) {
    const result = await this.service.download(id, documentId, actorFromRequest(request));
    return new StreamableFile(result.buffer, { type: result.document.mimeType, disposition: `attachment; filename="${encodeURIComponent(result.document.originalName)}"` });
  }
}
