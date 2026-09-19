import { Body, Controller, Get, Put, Req, StreamableFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { actorFromRequest } from '../../tce/model/tce.model';
import { StudentService } from '../service/student.service';

@Controller('students')
export class StudentsController {
  constructor(private service: StudentService) {}
  @Get('me') me(@Req() request: Request) { return this.service.me(actorFromRequest(request)); }
  @Get('me/photo')
  async photo(@Req() request: Request) {
    const result = await this.service.photo(actorFromRequest(request));
    return new StreamableFile(result.buffer, { type: result.mimeType, disposition: `inline; filename="${encodeURIComponent(result.originalName)}"` });
  }
  @Put('me')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'photo', maxCount: 1 }]))
  update(@Req() request: Request, @Body() data: any, @UploadedFiles() files: { photo?: Express.Multer.File[] }) { return this.service.update(actorFromRequest(request), data, files?.photo?.[0]); }
}
