import { PrismaClient, TceStatus } from '@prisma/client';
import argon2 from 'argon2';
const prisma = new PrismaClient();
async function main() {
 const [coordinatorRole, studentRole] = await Promise.all(['COORDINATOR','STUDENT'].map(code => prisma.role.upsert({where:{code},update:{},create:{code,name:code==='COORDINATOR'?'Coordenador':'Aluno'}})));
 const passwordHash=await argon2.hash('Senha@123');
 const coordinator=await prisma.user.upsert({where:{email:'coordenador@faeterj-petropolis.edu.br'},update:{},create:{email:'coordenador@faeterj-petropolis.edu.br',passwordHash,roles:{create:{roleId:coordinatorRole.id}},coordinator:{create:{name:'Coordenador de Estágios'}}}});
 const student=await prisma.user.upsert({where:{email:'aluno@faeterj-petropolis.edu.br'},update:{},create:{email:'aluno@faeterj-petropolis.edu.br',passwordHash,roles:{create:{roleId:studentRole.id}},student:{create:{enrollment:'2023100101',name:'Ana Beatriz Silva',email:'aluno@faeterj-petropolis.edu.br',phone:'(24) 99999-0000'}}}});
 const profile=await prisma.studentProfile.findUniqueOrThrow({where:{userId:student.id}}); const company=await prisma.company.upsert({where:{normalizedName:'tech solutions ltda.'},update:{},create:{name:'Tech Solutions Ltda.',normalizedName:'tech solutions ltda.'}});
 const exists=await prisma.tce.count(); if(!exists) await prisma.tce.create({data:{number:'2026/00001',studentId:profile.id,companyId:company.id,studentEnrollment:profile.enrollment,studentName:profile.name,studentEmail:profile.email,studentPhone:profile.phone,startDate:new Date('2026-02-01'),endDate:new Date('2026-12-20'),status:TceStatus.EM_ELABORACAO,history:{create:{toStatus:TceStatus.EM_ELABORACAO,actorId:student.id}}}});
 console.log('Seed concluído. Coordenador/aluno: Senha@123');
}
main().finally(()=>prisma.$disconnect());
