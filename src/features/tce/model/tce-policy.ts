import { TceStatus } from '@prisma/client';
import { RoleCode } from './tce.model';

export function canEdit(status: TceStatus) {
  return ([TceStatus.EM_ELABORACAO, TceStatus.CORRECAO_NECESSARIA] as TceStatus[]).includes(status);
}

export function canTransition(from: TceStatus, to: TceStatus, role: RoleCode) {
  if (role === 'STUDENT') {
    return (from === TceStatus.EM_ELABORACAO && ([TceStatus.EM_ANALISE, TceStatus.CANCELADO] as TceStatus[]).includes(to)) ||
      (from === TceStatus.CORRECAO_NECESSARIA && ([TceStatus.EM_ANALISE, TceStatus.CANCELADO] as TceStatus[]).includes(to));
  }
  return from === TceStatus.EM_ANALISE &&
    ([TceStatus.APROVADO, TceStatus.CORRECAO_NECESSARIA, TceStatus.INDEFERIDO] as TceStatus[]).includes(to);
}