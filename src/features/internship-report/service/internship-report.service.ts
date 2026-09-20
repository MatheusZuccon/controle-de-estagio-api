import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InternshipType, TceStatus } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { Actor, canEditInternshipReport, canTransitionInternshipReport } from '../model/internship-report.model';
import { InternshipReportPdfService } from './internship-report-pdf.service';

@Injectable()
export class InternshipReportService {
  constructor(private db: PrismaService, private pdf: InternshipReportPdfService) {}

  private coordinator(actor: Actor) { return actor.roles.includes('COORDINATOR'); }

  private async profile(actor: Actor) {
    if (!actor.roles.includes('STUDENT') || !actor.studentId) throw new ForbiddenException('Acesso exclusivo para alunos.');
    const profile = await this.db.studentProfile.findUnique({ where: { id: actor.studentId } });
    if (!profile) throw new NotFoundException('Perfil de aluno não encontrado.');
    if (!profile.profileCompletedAt) throw new ForbiddenException('Conclua o cadastro de estagiário antes de acessar relatórios.');
    return profile;
  }

  private date(value: unknown, label: string) {
    const raw = String(value ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new BadRequestException(`${label} inválida.`);
    const date = new Date(`${raw}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) throw new BadRequestException(`${label} inválida.`);
    return date;
  }

  private details(data: any) {
    const reportStartDate = this.date(data.reportStartDate, 'Data inicial do período relatado');
    const reportEndDate = this.date(data.reportEndDate, 'Data final do período relatado');
    const deliveredAt = this.date(data.deliveredAt, 'Data de entrega do relatório');
    if (reportEndDate < reportStartDate) throw new BadRequestException('A data final do período relatado deve ser posterior à inicial.');
    const hoursValue = String(data.hoursReported ?? '');
    if (!/^\d+$/.test(hoursValue) || Number(hoursValue) < 1 || Number(hoursValue) > 10000) throw new BadRequestException('Horas relatadas deve conter somente números entre 1 e 10000.');
    const activities = String(data.activities ?? '').trim();
    if (activities.length < 3 || activities.length > 6000) throw new BadRequestException('Atividades realizadas deve ter entre 3 e 6000 caracteres.');
    const internshipType = String(data.internshipType ?? '') as InternshipType;
    if (!Object.values(InternshipType).includes(internshipType)) throw new BadRequestException('Tipo de estágio inválido.');
    return { reportStartDate, reportEndDate, deliveredAt, hoursReported: Number(hoursValue), activities, internshipType };
  }

  private async tce(tceId: unknown, profileId: string) {
    const tce = await this.db.tce.findUnique({ where: { id: String(tceId ?? '') }, include: { company: true } });
    if (!tce || tce.studentId !== profileId) throw new NotFoundException('TCE do aluno não encontrado.');
    if (([TceStatus.CANCELADO, TceStatus.INDEFERIDO] as TceStatus[]).includes(tce.status)) throw new BadRequestException('Não é possível criar relatório para este TCE.');
    return tce;
  }

  private validatePeriod(reportStartDate: Date, reportEndDate: Date, tce: { startDate: Date; endDate: Date }) {
    if (reportStartDate < tce.startDate || reportEndDate > tce.endDate) throw new BadRequestException('O período relatado deve estar dentro do período previsto no TCE.');
  }

  private async get(id: string, actor: Actor) {
    const report = await this.db.internshipReport.findUnique({ where: { id }, include: { documents: { where: { active: true } }, history: { include: { actor: { select: { email: true } } }, orderBy: { createdAt: 'desc' } } } });
    if (!report) throw new NotFoundException('Relatório de estágio não encontrado.');
    const submitted = report.history.some(item => item.toStatus === TceStatus.EM_ANALISE);
    if ((!this.coordinator(actor) && report.studentId !== actor.studentId) || (this.coordinator(actor) && !submitted)) throw new ForbiddenException('Sem permissão para acessar este relatório.');
    return report;
  }

  private async persist(buffer: Buffer, originalName: string) {
    const directory = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
    await mkdir(directory, { recursive: true });
    const storageKey = `${randomUUID()}-${originalName}`;
    await writeFile(join(directory, storageKey), buffer);
    return { storageKey, originalName, mimeType: 'application/pdf', size: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex') };
  }

  async formData(actor: Actor) {
    const profile = await this.profile(actor);
    const tces = await this.db.tce.findMany({ where: { studentId: profile.id, status: { notIn: [TceStatus.CANCELADO, TceStatus.INDEFERIDO] } }, include: { company: true }, orderBy: { createdAt: 'desc' } });
    return { student: { name: profile.name, enrollment: profile.enrollment, email: profile.email, phone: profile.phone, internshipType: profile.internshipType }, tces: tces.map(tce => ({ id: tce.id, number: tce.number, company: tce.company.name, internshipType: tce.internshipType, startDate: tce.startDate, endDate: tce.endDate })) };
  }

  async list(actor: Actor, query: any) {
    if (!this.coordinator(actor)) await this.profile(actor);
    const where: any = this.coordinator(actor) ? { history: { some: { toStatus: TceStatus.EM_ANALISE } } } : { studentId: actor.studentId };
    if (query.status) where.status = query.status;
    if (query.enrollment) where.studentEnrollment = { contains: String(query.enrollment) };
    if (query.company) where.companyName = { contains: String(query.company) };
    const page = Math.max(1, Number(query.page) || 1), pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 10));
    const [total, items] = await this.db.$transaction([this.db.internshipReport.count({ where }), this.db.internshipReport.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' } })]);
    return { total, items, page, pageSize };
  }

  async create(actor: Actor, data: any) {
    const profile = await this.profile(actor);
    const details = this.details(data);
    const tce = await this.tce(data.tceId, profile.id);
    this.validatePeriod(details.reportStartDate, details.reportEndDate, tce);
    return this.db.internshipReport.create({ data: { studentId: profile.id, tceId: tce.id, studentEnrollment: profile.enrollment, studentName: profile.name, studentEmail: profile.email, studentPhone: profile.phone, companyName: tce.company.name, contractStartDate: tce.startDate, contractEndDate: tce.endDate, ...details, history: { create: { toStatus: TceStatus.EM_ELABORACAO, actorId: actor.id } } } });
  }

  async update(id: string, actor: Actor, data: any) {
    const report = await this.get(id, actor);
    if (!actor.studentId || !canEditInternshipReport(report.status)) throw new BadRequestException('Relatório não pode ser editado neste status.');
    const profile = await this.profile(actor);
    const details = this.details(data);
    const tce = await this.tce(data.tceId ?? report.tceId, profile.id);
    this.validatePeriod(details.reportStartDate, details.reportEndDate, tce);
    return this.db.internshipReport.update({ where: { id }, data: { tceId: tce.id, studentEnrollment: profile.enrollment, studentName: profile.name, studentEmail: profile.email, studentPhone: profile.phone, companyName: tce.company.name, contractStartDate: tce.startDate, contractEndDate: tce.endDate, ...details } });
  }

  async generateDocument(id: string, actor: Actor) {
    const report = await this.get(id, actor);
    if (!actor.studentId || !canEditInternshipReport(report.status)) throw new BadRequestException('Relatório não pode gerar documento neste status.');
    const buffer = await this.pdf.generate(report);
    const originalName = `relatorio-estagio-${report.studentEnrollment}-${id}.pdf`;
    const document = await this.persist(buffer, originalName);
    return this.db.internshipReport.update({ where: { id }, data: { documents: { updateMany: { where: { active: true }, data: { active: false } }, create: { ...document, uploadedById: actor.id } } }, include: { documents: { where: { active: true } } } });
  }

  async transition(id: string, actor: Actor, to: TceStatus, reason?: string) {
    const report = await this.get(id, actor);
    if (!canTransitionInternshipReport(report.status, to, actor)) throw new BadRequestException('Transição de status inválida.');
    if ((to === TceStatus.CORRECAO_NECESSARIA || to === TceStatus.INDEFERIDO) && !reason?.trim()) throw new BadRequestException('Motivo obrigatório.');
    if (to === TceStatus.EM_ANALISE && !report.documents.length) throw new BadRequestException('Gere o documento PDF antes de enviar para análise.');
    return this.db.internshipReport.update({ where: { id }, data: { status: to, history: { create: { fromStatus: report.status, toStatus: to, reason: reason?.trim(), actorId: actor.id } } } });
  }

  detail(id: string, actor: Actor) { return this.get(id, actor); }
  async history(id: string, actor: Actor) { return (await this.get(id, actor)).history; }

  async download(id: string, documentId: string, actor: Actor) {
    const report = await this.get(id, actor);
    const document = report.documents.find(item => item.id === documentId);
    if (!document) throw new NotFoundException('Documento não encontrado.');
    try { return { document, buffer: await readFile(join(process.env.UPLOAD_DIR || join(process.cwd(), 'uploads'), document.storageKey)) }; }
    catch { throw new NotFoundException('Arquivo físico não encontrado.'); }
  }
}
