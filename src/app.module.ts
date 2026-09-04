import { Module } from '@nestjs/common'; import { PrismaService } from './infrastructure/prisma.service'; import { TceService } from './application/tce.service'; import { AuthController, ReportsController, TcesController } from './presentation/app.controller';
@Module({controllers:[AuthController,TcesController,ReportsController],providers:[PrismaService,TceService]}) export class AppModule {}
