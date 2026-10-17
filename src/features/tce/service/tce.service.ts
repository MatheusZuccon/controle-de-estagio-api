import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentType, InternshipType, TceStatus } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { Actor, RoleCode } from '../model/tce.model';
import { canEdit, canTransition } from '../model/tce-policy';

type FileData = { buffer: Buffer; originalname: string; mimetype: string; size: number };

@Injectable()
export class TceService {
  constructor(private db: PrismaService) {}

  private coordinator(actor: Actor): boolean { return actor.roles.includes('COORDINATOR'); }
  private async ensureProfileComplete(actor: Actor): Promise<void> {
    if (this.coordinator(actor)) return;
    if (!actor.studentId) throw new ForbiddenException('Somente alunos podem acessar TCE.');
    const profile = await this.db.studentProfile.findUnique({ where: { id: actor.studentId }, select: { profileCompletedAt: true } });
    if (!profile?.profileCompletedAt) throw new ForbiddenException('Conclua o cadastro de estagiário antes de acessar o TCE.');
  }
  private paidInternship(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    const normalizedValue = typeof value === 'string' ? value.trim().toLocaleLowerCase('pt-BR') : value;
    if (normalizedValue === 'true' || normalizedValue === 'sim') return true;
    if (normalizedValue === 'false' || normalizedValue === 'não' || normalizedValue === 'nao') return false;
    throw new BadRequestException('O campo "Estágio remunerado" é obrigatório e deve ser "sim" ou "não".');
  }
  private stipendAmount(value: unknown, isPaid: boolean): number | null {
    if (!isPaid) return null;
    const cents = Number(String(value ?? '').replace(/\D/g, ''));
    if (!Number.isSafeInteger(cents) || cents <= 0) throw new BadRequestException('O valor da bolsa é obrigatório para estágio remunerado.');
    if (cents > 9999999) throw new BadRequestException('O valor da bolsa deve conter no máximo sete dígitos, incluindo os centavos.');
    return cents;
  }
  private internshipType(value: unknown): InternshipType {
    const type = String(value ?? '') as InternshipType;
    if (!Object.values(InternshipType).includes(type)) throw new BadRequestException('Tipo de estágio inválido.');
    return type;
  }
  private period(data: any): { startDate: Date; endDate: Date } {
    const date = (value: unknown, label: string): Date => {
      const raw = String(value ?? '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new BadRequestException(`${label} inválida.`);
      const parsed = new Date(`${raw}T00:00:00.000Z`);
      if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) throw new BadRequestException(`${label} inválida.`);
      return parsed;
    };
    const startDate = date(data.startDate, 'Data de início');
    const endDate = date(data.endDate, 'Data de término');
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const part = (type: string) => parts.find(item => item.type === type)?.value;
    const today = `${part('year')}-${part('month')}-${part('day')}`;
    if (startDate.toISOString().slice(0, 10) < today) throw new BadRequestException('A data de início deve ser igual ou posterior à data atual.');
    if (endDate <= startDate) throw new BadRequestException('A data de término deve ser posterior à data de início.');
    return { startDate, endDate };
  }
  private async get(id: string, actor: Actor) {
    await this.ensureProfileComplete(actor);
    const tce = await this.db.tce.findUnique({ where: { id }, include: { company: true, documents: { where: { active: true } }, history: { include: { actor: { select: { email: true } } }, orderBy: { createdAt: 'desc' } } } });
    if (!tce) throw new NotFoundException('TCE não encontrado.');
    if ((!this.coordinator(actor) && tce.studentId !== actor.studentId) || (this.coordinator(actor) && !tce.history.some(event => event.toStatus === TceStatus.EM_ANALISE))) throw new ForbiddenException('Sem permissão para acessar este TCE.');
    return tce;
  }

  private async company(name: string) {
    const normalizedName = name.trim().toLocaleLowerCase('pt-BR');
    if (!normalizedName) throw new BadRequestException('Empresa é obrigatória.');
    return this.db.company.upsert({ where: { normalizedName }, update: { name: name.trim() }, create: { name: name.trim(), normalizedName } });
  }

  private async persist(file: FileData, type: DocumentType) {
    const directory = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
    await mkdir(directory, { recursive: true });
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `${randomUUID()}-${safeName}`;
    await writeFile(join(directory, storageKey), file.buffer);
    return { type, storageKey, originalName: file.originalname, mimeType: file.mimetype, size: file.size, sha256: createHash('sha256').update(file.buffer).digest('hex') };
  }

  async list(actor: Actor, query: any) {
    await this.ensureProfileComplete(actor);
    const where: any = this.coordinator(actor) ? { history: { some: { toStatus: TceStatus.EM_ANALISE } } } : { studentId: actor.studentId };
    if (query.number) where.number = { contains: String(query.number) };
    if (query.status) where.status = query.status;
    if (query.company) where.company = { name: { contains: String(query.company) } };
    if (query.enrollment) where.studentEnrollment = { contains: String(query.enrollment) };
    const page = Math.max(1, Number(query.page) || 1), pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 10));
    const sortFields = ['number', 'studentName', 'studentEnrollment', 'company', 'createdAt', 'status'];
    if (query.sortBy !== undefined && !sortFields.includes(query.sortBy)) throw new BadRequestException('Coluna de ordenação inválida.');
    if (query.sortDirection !== undefined && !['asc', 'desc'].includes(query.sortDirection)) throw new BadRequestException('Direção de ordenação inválida.');
    const sortBy = query.sortBy || 'createdAt';
    const direction: 'asc' | 'desc' = query.sortDirection || 'desc';
    const sort = sortBy === 'company' ? { company: { name: direction } } : { [sortBy]: direction };
    const orderBy = [sort, { id: 'asc' as const }];
    const [total, items] = await this.db.$transaction([this.db.tce.count({ where }), this.db.tce.findMany({ where, include: { company: true }, skip: (page - 1) * pageSize, take: pageSize, orderBy })]);
    return { total, items, page, pageSize };
  }

  async create(actor: Actor, data: any, pdf?: FileData, photo?: FileData) {
    await this.ensureProfileComplete(actor);
    if (!actor.studentId) throw new ForbiddenException('Somente alunos podem cadastrar TCE.');
    if (!pdf || pdf.mimetype !== 'application/pdf') throw new BadRequestException('Documento PDF obrigatório.');
    if (photo && !photo.mimetype.startsWith('image/')) throw new BadRequestException('A foto deve ser uma imagem.');
    const isPaid = this.paidInternship(data.isPaid);
    const stipendAmount = this.stipendAmount(data.stipendAmount, isPaid);
    const internshipType = this.internshipType(data.internshipType);
    const { startDate, endDate } = this.period(data);
    const company = await this.company(data.companyName);
    const document = await this.persist(pdf, DocumentType.TCE_PDF);
    const photoDocument = photo ? await this.persist(photo, DocumentType.STUDENT_PHOTO) : undefined;
    return this.db.tce.create({ data: { number: data.number, studentId: actor.studentId, companyId: company.id, studentEnrollment: data.enrollment, studentName: data.studentName, studentEmail: data.email, studentPhone: data.phone, studentPhotoKey: photoDocument?.storageKey, isPaid, stipendAmount, internshipType, startDate, endDate, documents: { create: [ { ...document, uploadedById: actor.id }, ...(photoDocument ? [{ ...photoDocument, uploadedById: actor.id }] : []) ] }, history: { create: { toStatus: TceStatus.EM_ELABORACAO, actorId: actor.id } } }, include: { company: true, documents: true } });
  }

  async update(id: string, actor: Actor, data: any, pdf?: FileData, photo?: FileData) {
    const tce = await this.get(id, actor);
    if (!actor.studentId || !canEdit(tce.status)) throw new BadRequestException('TCE não pode ser editado neste status.');
    if (pdf && pdf.mimetype !== 'application/pdf') throw new BadRequestException('Documento do TCE deve ser PDF.');
    if (photo && !photo.mimetype.startsWith('image/')) throw new BadRequestException('A foto deve ser uma imagem.');
    const isPaid = this.paidInternship(data.isPaid);
    const stipendAmount = this.stipendAmount(data.stipendAmount, isPaid);
    const internshipType = this.internshipType(data.internshipType);
    const { startDate, endDate } = this.period(data);
    const company = await this.company(data.companyName);
    const document = pdf ? await this.persist(pdf, DocumentType.TCE_PDF) : undefined;
    const photoDocument = photo ? await this.persist(photo, DocumentType.STUDENT_PHOTO) : undefined;
    return this.db.tce.update({ where: { id }, data: { number: data.number, companyId: company.id, studentEnrollment: data.enrollment, studentName: data.studentName, studentEmail: data.email, studentPhone: data.phone, isPaid, stipendAmount, internshipType, startDate, endDate, ...(photoDocument ? { studentPhotoKey: photoDocument.storageKey } : {}), ...(document || photoDocument ? { documents: { updateMany: { where: { active: true, type: { in: [ ...(document ? [DocumentType.TCE_PDF] : []), ...(photoDocument ? [DocumentType.STUDENT_PHOTO] : []) ] } }, data: { active: false } }, create: [ ...(document ? [{ ...document, uploadedById: actor.id }] : []), ...(photoDocument ? [{ ...photoDocument, uploadedById: actor.id }] : []) ] } } : {}) }, include: { company: true, documents: { where: { active: true } } } });
  }

  async transition(id: string, actor: Actor, to: TceStatus, reason?: string) {
    const tce = await this.get(id, actor);
    if (!canTransition(tce.status, to, this.coordinator(actor) ? 'COORDINATOR' : 'STUDENT')) throw new BadRequestException('Transição de status inválida.');
    if (reason !== undefined && (typeof reason !== 'string' || reason.length > 1000)) throw new BadRequestException('A justificativa deve ter no máximo 1000 caracteres.');
    if ((to === TceStatus.CORRECAO_NECESSARIA || to === TceStatus.INDEFERIDO) && !reason?.trim()) throw new BadRequestException('Motivo obrigatório.');
    return this.db.tce.update({ where: { id }, data: { status: to, history: { create: { fromStatus: tce.status, toStatus: to, reason: reason?.trim(), actorId: actor.id } } } });
  }

  detail(id: string, actor: Actor) { return this.get(id, actor); }
  async history(id: string, actor: Actor) { return (await this.get(id, actor)).history; }
  async studentPhoto(id: string, actor: Actor) {
    const tce = await this.get(id, actor);
    const profile = await this.db.studentProfile.findUnique({ where: { id: tce.studentId }, select: { photoKey: true, photoMimeType: true, photoOriginalName: true } });
    if (!profile?.photoKey) throw new NotFoundException('Foto não cadastrada.');
    const directory = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
    try { return { buffer: await readFile(join(directory, profile.photoKey)), mimeType: profile.photoMimeType || 'application/octet-stream', originalName: profile.photoOriginalName || 'foto-aluno' }; }
    catch { throw new NotFoundException('Arquivo físico não encontrado.'); }
  }
  async download(id: string, documentId: string, actor: Actor) {
    const tce = await this.get(id, actor);
    const document = tce.documents.find(item => item.id === documentId);
    if (!document) throw new NotFoundException('Documento não encontrado.');
    const directory = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
    try { return { document, buffer: await readFile(join(directory, document.storageKey)) }; }
    catch { throw new NotFoundException('Arquivo físico não encontrado.'); }
  }
}
