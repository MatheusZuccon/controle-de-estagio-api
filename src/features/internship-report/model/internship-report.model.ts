import { TceStatus } from '@prisma/client';
import { Actor } from '../../tce/model/tce.model';

export { Actor };

export function canEditInternshipReport(status: TceStatus) {
  return ([TceStatus.EM_ELABORACAO, TceStatus.CORRECAO_NECESSARIA] as TceStatus[]).includes(status);
}

export function canTransitionInternshipReport(from: TceStatus, to: TceStatus, actor: Actor) {
  if (actor.roles.includes('STUDENT')) {
    return (from === TceStatus.EM_ELABORACAO || from === TceStatus.CORRECAO_NECESSARIA) &&
      (to === TceStatus.EM_ANALISE || to === TceStatus.CANCELADO);
  }
  return actor.roles.includes('COORDINATOR') && from === TceStatus.EM_ANALISE &&
    ([TceStatus.APROVADO, TceStatus.CORRECAO_NECESSARIA, TceStatus.INDEFERIDO] as TceStatus[]).includes(to);
}
