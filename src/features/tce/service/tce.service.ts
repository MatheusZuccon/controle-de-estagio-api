import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentType, TceStatus } from '@prisma/client';
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
  private async get(id: string, actor: Actor) {
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
    const where: any = this.coordinator(actor) ? { history: { some: { toStatus: TceStatus.EM_ANALISE } } } : { studentId: actor.studentId };
    if (query.number) where.number = { contains: String(query.number) };
    if (query.status) where.status = query.status;
    if (query.company) where.company = { name: { contains: String(query.company) } };
    if (query.enrollment) where.studentEnrollment = { contains: String(query.enrollment) };
    const page = Math.max(1, Number(query.page) || 1), pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 10));
    const [total, items] = await this.db.$transaction([this.db.tce.count({ where }), this.db.tce.findMany({ where, include: { company: true }, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' } })]);
    return { total, items, page, pageSize };
  }

  async create(actor: Actor, data: any, pdf?: FileData, photo?: FileData) {
    if (!actor.studentId) throw new ForbiddenException('Somente alunos podem cadastrar TCE.');
    if (!pdf || pdf.mimetype !== 'application/pdf') throw new BadRequestException('Documento PDF obrigatório.');
    if (photo && !photo.mimetype.startsWith('image/')) throw new BadRequestException('A foto deve ser uma imagem.');
    const company = await this.company(data.companyName);
    const document = await this.persist(pdf, DocumentType.TCE_PDF);
    const photoDocument = photo ? await this.persist(photo, DocumentType.STUDENT_PHOTO) : undefined;
    return this.db.tce.create({ data: { number: data.number, studentId: actor.studentId, companyId: company.id, studentEnrollment: data.enrollment, studentName: data.studentName, studentEmail: data.email, studentPhone: data.phone, studentPhotoKey: photoDocument?.storageKey, startDate: new Date(data.startDate), endDate: new Date(data.endDate), documents: { create: [ { ...document, uploadedById: actor.id }, ...(photoDocument ? [{ ...photoDocument, uploadedById: actor.id }] : []) ] }, history: { create: { toStatus: TceStatus.EM_ELABORACAO, actorId: actor.id } } }, include: { company: true, documents: true } });
  }

  async update(id: string, actor: Actor, data: any, pdf?: FileData, photo?: FileData) {
    const tce = await this.get(id, actor);
    if (!actor.studentId || !canEdit(tce.status)) throw new BadRequestException('TCE não pode ser editado neste status.');
    if (pdf && pdf.mimetype !== 'application/pdf') throw new BadRequestException('Documento do TCE deve ser PDF.');
    if (photo && !photo.mimetype.startsWith('image/')) throw new BadRequestException('A foto deve ser uma imagem.');
    const company = await this.company(data.companyName);
    const document = pdf ? await this.persist(pdf, DocumentType.TCE_PDF) : undefined;
    const photoDocument = photo ? await this.persist(photo, DocumentType.STUDENT_PHOTO) : undefined;
    return this.db.tce.update({ where: { id }, data: { number: data.number, companyId: company.id, studentEnrollment: data.enrollment, studentName: data.studentName, studentEmail: data.email, studentPhone: data.phone, startDate: new Date(data.startDate), endDate: new Date(data.endDate), ...(photoDocument ? { studentPhotoKey: photoDocument.storageKey } : {}), ...(document || photoDocument ? { documents: { updateMany: { where: { active: true, type: { in: [ ...(document ? [DocumentType.TCE_PDF] : []), ...(photoDocument ? [DocumentType.STUDENT_PHOTO] : []) ] } }, data: { active: false } }, create: [ ...(document ? [{ ...document, uploadedById: actor.id }] : []), ...(photoDocument ? [{ ...photoDocument, uploadedById: actor.id }] : []) ] } } : {}) }, include: { company: true, documents: { where: { active: true } } } });
  }

  async transition(id: string, actor: Actor, to: TceStatus, reason?: string) {
    const tce = await this.get(id, actor);
    if (!canTransition(tce.status, to, this.coordinator(actor) ? 'COORDINATOR' : 'STUDENT')) throw new BadRequestException('Transição de status inválida.');
    if ((to === TceStatus.CORRECAO_NECESSARIA || to === TceStatus.INDEFERIDO) && !reason?.trim()) throw new BadRequestException('Motivo obrigatório.');
    return this.db.tce.update({ where: { id }, data: { status: to, history: { create: { fromStatus: tce.status, toStatus: to, reason: reason?.trim(), actorId: actor.id } } } });
  }

  detail(id: string, actor: Actor) { return this.get(id, actor); }
  async history(id: string, actor: Actor) { return (await this.get(id, actor)).history; }
  async download(id: string, documentId: string, actor: Actor) {
    const tce = await this.get(id, actor);
    const document = tce.documents.find(item => item.id === documentId);
    if (!document) throw new NotFoundException('Documento não encontrado.');
    const directory = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
    try { return { document, buffer: await readFile(join(directory, document.storageKey)) }; }
    catch { throw new NotFoundException('Arquivo físico não encontrado.'); }
  }
}