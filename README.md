# Controle de Estágio API

Copie `.env.example` para `.env`, execute `npm install`, `npm run prisma:migrate -- --name init`, `npm run prisma:generate` e `npm run seed`. A API fica em `http://localhost:3000/api/v1` e o Swagger em `/api/docs`.

Seeds: `coordenador@faeterj-petropolis.edu.br` e `aluno@faeterj-petropolis.edu.br`, ambos com senha `Senha@123`.

## Relatórios de estágio

O endpoint `GET /api/v1/internship-reports/form-data` devolve os dados fixos do aluno autenticado e os TCEs disponíveis para preencher o formulário. Crie o rascunho com `POST /api/v1/internship-reports`, usando `tceId`, `internshipType`, `reportStartDate`, `reportEndDate`, `deliveredAt`, `hoursReported` e `activities`.

Em seguida, `POST /api/v1/internship-reports/:id/generate-document` cria o PDF baseado no modelo institucional. O envio e a análise seguem o mesmo fluxo do TCE: `submit`, `cancel`, `review`, `history` e download do documento. Datas devem ser enviadas no formato `YYYY-MM-DD`; as datas de contrato e os dados pessoais são sempre obtidos no servidor.
