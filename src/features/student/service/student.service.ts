import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EducationLevel, InternshipType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { Actor } from '../../tce/model/tce.model';

type FileData = { buffer: Buffer; originalname: string; mimetype: string; size: number };

@Injectable()
export class StudentService {
  constructor(private db: PrismaService) {}

  private studentId(actor: Actor): string {
    if (!actor.roles.includes('STUDENT') || !actor.studentId) throw new ForbiddenException('Acesso exclusivo para alunos.');
    return actor.studentId;
  }

  private async profile(actor: Actor) {
    const profile = await this.db.studentProfile.findUnique({ where: { id: this.studentId(actor) } });
    if (!profile) throw new NotFoundException('Perfil de aluno não encontrado.');
    return profile;
  }

  private required(value: unknown, label: string, min = 1, max = 150): string {
    const text = String(value ?? '').trim();
    if (text.length < min || text.length > max) throw new BadRequestException(`${label} deve ter entre ${min} e ${max} caracteres.`);
    return text;
  }

  private optional(value: unknown, max = 150): string | null {
    const text = String(value ?? '').trim();
    if (!text) return null;
    if (text.length > max) throw new BadRequestException(`Campo deve ter no máximo ${max} caracteres.`);
    return text;
  }

  private cpf(value: unknown): string {
    const cpf = String(value ?? '').replace(/\D/g, '');
    if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) throw new BadRequestException('CPF inválido.');
    const digit = (length: number) => {
      const sum = cpf.slice(0, length).split('').reduce((total, item, index) => total + Number(item) * (length + 1 - index), 0);
      const result = (sum * 10) % 11;
      return result === 10 ? 0 : result;
    };
    if (digit(9) !== Number(cpf[9]) || digit(10) !== Number(cpf[10])) throw new BadRequestException('CPF inválido.');
    return cpf;
  }

  private internshipType(value: unknown): InternshipType {
    const type = String(value ?? '') as InternshipType;
    if (!Object.values(InternshipType).includes(type)) throw new BadRequestException('Tipo de estágio inválido.');
    return type;
  }

  private minimumAge(birthDate: Date): void {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const birthdayReached = today.getMonth() > birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
    if (!birthdayReached) age -= 1;
    if (age < 16) throw new BadRequestException('O estagiário deve ter no mínimo 16 anos.');
  }

  private serialize(profile: any) {
    const { photoKey, photoMimeType, photoOriginalName, ...data } = profile;
    return { ...data, photoAvailable: Boolean(photoKey), profileCompleted: Boolean(profile.profileCompletedAt) };
  }

  private async persistPhoto(file: FileData) {
    if (!file.mimetype.startsWith('image/')) throw new BadRequestException('A foto deve ser uma imagem.');
    const directory = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
    await mkdir(directory, { recursive: true });
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `${randomUUID()}-${safeName}`;
    await writeFile(join(directory, storageKey), file.buffer);
    return { photoKey: storageKey, photoMimeType: file.mimetype, photoOriginalName: file.originalname };
  }

  async me(actor: Actor) { return this.serialize(await this.profile(actor)); }

  async update(actor: Actor, data: any, photo?: FileData) {
    const current = await this.profile(actor);
    const enrollment = String(data.enrollment ?? '').replace(/\D/g, '');
    if (!/^\d{3,16}$/.test(enrollment)) throw new BadRequestException('Matrícula deve conter de 3 a 16 números.');
    const postalCode = String(data.postalCode ?? '').replace(/\D/g, '');
    if (!/^\d{8}$/.test(postalCode)) throw new BadRequestException('CEP inválido.');
    const phone = this.required(data.phone, 'Telefone celular', 3, 15);
    if (!/^\d{10,11}$/.test(phone.replace(/\D/g, ''))) throw new BadRequestException('Telefone celular inválido.');
    const birthDate = new Date(String(data.birthDate ?? ''));
    if (Number.isNaN(birthDate.getTime())) throw new BadRequestException('Data de nascimento inválida.');
    this.minimumAge(birthDate);
    const course = this.required(data.course, 'Curso');
    if (course !== 'Tecnologia da Informação e Comunicação - TIC') throw new BadRequestException('Curso inválido.');
    const academicPeriod = String(data.academicPeriod ?? '');
    if (!['1', '2', '3', '4', '5'].includes(academicPeriod)) throw new BadRequestException('Período/Módulo inválido.');
    const educationLevel = String(data.educationLevel ?? '') as EducationLevel;
    if (!Object.values(EducationLevel).includes(educationLevel)) throw new BadRequestException('Nível de escolaridade inválido.');
    const values = {
      name: this.required(data.name, 'Nome', 3, 150), enrollment, phone, socialName: this.optional(data.socialName, 150), birthDate,
      gender: this.optional(data.gender, 100), address: this.required(data.address, 'Endereço', 3, 200), postalCode,
      neighborhood: this.required(data.neighborhood, 'Bairro', 3, 150), city: this.required(data.city, 'Cidade', 3, 150),
      state: this.required(data.state, 'UF', 2, 2).toUpperCase(), course, identity: this.required(data.identity, 'Identidade', 1, 50),
      cpf: this.cpf(data.cpf), academicPeriod, educationLevel, internshipType: this.internshipType(data.internshipType), profileCompletedAt: current.profileCompletedAt || new Date(),
      ...(photo ? await this.persistPhoto(photo) : {}),
    };
    try { return this.serialize(await this.db.studentProfile.update({ where: { id: current.id }, data: values })); }
    catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('Matrícula ou CPF já está em uso por outro aluno.');
      throw error;
    }
  }

  async photo(actor: Actor) {
    const profile = await this.profile(actor);
    if (!profile.photoKey) throw new NotFoundException('Foto não cadastrada.');
    const directory = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');
    try { return { buffer: await readFile(join(directory, profile.photoKey)), mimeType: profile.photoMimeType || 'application/octet-stream', originalName: profile.photoOriginalName || 'foto-aluno' }; }
    catch { throw new NotFoundException('Arquivo físico não encontrado.'); }
  }
}
