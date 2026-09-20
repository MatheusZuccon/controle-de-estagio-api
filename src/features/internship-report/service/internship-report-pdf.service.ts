import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';
import { readFile } from 'fs/promises';
import { join } from 'path';

export type InternshipReportPdfData = {
  studentName: string;
  studentEnrollment: string;
  studentEmail: string;
  studentPhone: string;
  internshipType: 'SUPERVISIONADO' | 'VOLUNTARIO' | 'OUTRO';
  companyName: string;
  reportStartDate: Date;
  reportEndDate: Date;
  contractStartDate: Date;
  contractEndDate: Date;
  deliveredAt: Date;
  hoursReported: number;
  activities: string;
};

type TextArea = { page: PDFPage; startY: number; endY: number };

@Injectable()
export class InternshipReportPdfService {
  private readonly assets = join(process.cwd(), 'assets');
  private readonly templatePath = join(this.assets, 'relatorio-estagio-modelo.pdf');
  private readonly calibriPath = join(this.assets, 'calibri-modelo.ttf');
  private readonly arialPath = join(this.assets, 'arial-modelo.ttf');
  private readonly arialBoldPath = join(this.assets, 'arial-bold-modelo.ttf');

  private date(date: Date) {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' }).format(date);
  }

  private text(value: string) {
    return value.replace(/[\r\t]+/g, ' ').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  }

  private fit(font: PDFFont, value: string, maxWidth: number, preferredSize = 11) {
    const safe = this.text(value);
    for (let size = preferredSize; size >= 8; size -= 0.25) {
      if (font.widthOfTextAtSize(safe, size) <= maxWidth) return { value: safe, size };
    }
    let shortened = safe;
    while (shortened.length > 1 && font.widthOfTextAtSize(`${shortened}...`, 8) > maxWidth) shortened = shortened.slice(0, -1);
    return { value: `${shortened}...`, size: 8 };
  }

  private wrap(font: PDFFont, value: string, maxWidth: number, size: number) {
    const result: string[] = [];
    for (const paragraph of value.replace(/\r/g, '').split('\n')) {
      const words = this.text(paragraph).trim().split(/\s+/).filter(Boolean);
      if (!words.length) { result.push(''); continue; }
      let line = '';
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= maxWidth) { line = candidate; continue; }
        if (line) result.push(line);
        line = word;
        while (font.widthOfTextAtSize(line, size) > maxWidth) {
          let cut = line.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > maxWidth) cut -= 1;
          result.push(line.slice(0, cut));
          line = line.slice(cut);
        }
      }
      result.push(line);
    }
    return result;
  }

  private clear(page: PDFPage, x: number, y: number, width: number, height: number) {
    page.drawRectangle({ x, y, width, height, color: rgb(1, 1, 1) });
  }

  private clearIdentification(page: PDFPage) {
    this.clear(page, 217, 679, 205, 16);
    for (const y of [662, 642]) {
      this.clear(page, 87, y, 318, 16);
      this.clear(page, 408, y, 130, 16);
    }
    for (const y of [622, 602]) this.clear(page, 87, y, 450, 16);
    for (const y of [582, 562, 542]) {
      this.clear(page, 87, y, 216, 16);
      this.clear(page, 306, y, 232, 16);
    }
  }

  private drawIdentification(page: PDFPage, font: PDFFont, data: InternshipReportPdfData) {
    this.clearIdentification(page);
    const draw = (value: string, x: number, y: number, width: number, size = 11) => {
      const fitted = this.fit(font, value, width, size);
      page.drawText(fitted.value, { x, y, size: fitted.size, font, color: rgb(0, 0, 0) });
    };
    draw('RELATÓRIO DE ESTÁGIO SUPERVISIONADO', 221.3, 683.6, 194, 11);
    draw(`Aluno(a):  ${data.studentName}`, 94.8, 666.4, 310, 11);
    draw(`Matrícula: ${data.studentEnrollment}`, 414.3, 666.4, 121, 11);
    draw(`E-mail: ${data.studentEmail}`, 94.8, 646.2, 310, 11);
    draw(`Telefone: ${data.studentPhone}`, 414.3, 646.2, 121, 11);
    const mark = (expected: InternshipReportPdfData['internshipType']) => data.internshipType === expected ? 'X' : ' ';
    draw(`Tipo de Estágio: Supervisionado ( ${mark('SUPERVISIONADO')} )   Voluntário  ( ${mark('VOLUNTARIO')} )  Outro ( ${mark('OUTRO')} )`, 94.8, 626.1, 440, 11);
    draw(`Empresa: ${data.companyName}`, 94.8, 605.9, 440, 11);
    draw(`   Período relatado:   ${this.date(data.reportStartDate)}  a   ${this.date(data.reportEndDate)}`, 94.7, 585.7, 310, 11);
    draw(`Período no contrato:  ${this.date(data.contractStartDate)}  a  ${this.date(data.contractEndDate)}`, 314.5, 585.7, 220, 11);
    draw(`Data da entrega do relatório:  ${this.date(data.deliveredAt)}`, 105.2, 565.5, 270, 11);
    draw(`Horas relatadas: ${data.hoursReported}`, 379.8, 565.5, 150, 11);
    draw('EXAMINADORES', 175.9, 545.3, 100, 11);
    draw('Parecer técnico', 405.5, 545.3, 100, 11);
    page.drawLine({ start: { x: 85, y: 680.5 }, end: { x: 540, y: 680.5 }, thickness: 0.7, color: rgb(0, 0, 0) });
    for (const [startX, endX, y] of [[182, 234, 584.5], [242, 288, 584.5], [409, 456, 584.5], [466, 511, 584.5], [236, 281, 564.5]] as const) {
      page.drawLine({ start: { x: startX, y }, end: { x: endX, y }, thickness: 0.7, color: rgb(0, 0, 0) });
    }
  }

  private month(date: Date) {
    const value = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(date);
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  private activityTitle(data: InternshipReportPdfData) {
    const start = this.month(data.reportStartDate);
    const end = this.month(data.reportEndDate);
    const period = start === end ? `no mês de ${start}` : `nos meses de ${start} à ${end}`;
    const type = data.internshipType === 'SUPERVISIONADO' ? 'Supervisionado' : data.internshipType === 'VOLUNTARIO' ? 'Voluntário' : 'Outro';
    return [`Atividades Realizadas ${period} em Estágio`, type];
  }

  private activityLayout(font: PDFFont, activities: string) {
    const configurations = [
      { size: 11, lineHeight: 14.55 },
      { size: 10.5, lineHeight: 13.9 },
      { size: 10, lineHeight: 13.2 },
      { size: 9.5, lineHeight: 12.6 },
      { size: 9, lineHeight: 12 },
    ];
    for (const config of configurations) {
      const lines = this.wrap(font, activities, 410, config.size);
      const capacity = Math.floor((341.7 - 170) / config.lineHeight) + 1 + Math.floor((683.9 - 170) / config.lineHeight) + 1 + Math.floor((683.9 - 520) / config.lineHeight) + 1;
      if (lines.length <= capacity) return { ...config, lines };
    }
    return { ...configurations.at(-1)!, lines: this.wrap(font, activities, 410, 9) };
  }

  private drawActivities(pages: PDFPage[], regular: PDFFont, bold: PDFFont, data: InternshipReportPdfData) {
    this.clear(pages[0], 80, 160, 440, 245);
    this.clear(pages[1], 80, 165, 440, 540);
    this.clear(pages[2], 80, 515, 440, 190);

    const titleLines = this.activityTitle(data);
    let titleY = 382.8;
    for (const line of titleLines) {
      pages[0].drawText(line, { x: 85.1, y: titleY, size: 11, font: bold, color: rgb(0, 0, 0) });
      titleY -= 14.55;
    }

    const layout = this.activityLayout(regular, data.activities);
    const areas: TextArea[] = [
      { page: pages[0], startY: Math.min(341.7, titleY - 12), endY: 170 },
      { page: pages[1], startY: 683.9, endY: 170 },
      { page: pages[2], startY: 683.9, endY: 520 },
    ];
    let index = 0;
    for (const area of areas) {
      let y = area.startY;
      while (index < layout.lines.length && y >= area.endY) {
        if (layout.lines[index]) area.page.drawText(layout.lines[index], { x: 85.1, y, size: layout.size, font: regular, color: rgb(0, 0, 0) });
        y -= layout.lineHeight;
        index += 1;
      }
    }
    if (index < layout.lines.length) {
      throw new BadRequestException('As atividades excedem o espaço disponível nas três páginas do modelo. Resuma o texto antes de gerar o documento.');
    }
  }

  async generate(data: InternshipReportPdfData): Promise<Buffer> {
    let source: Buffer, calibriBytes: Buffer, arialBytes: Buffer, arialBoldBytes: Buffer;
    const windowsFonts = join(process.env.WINDIR || 'C:\\Windows', 'Fonts');
    const readPreferredFont = async (configured: string | undefined, systemName: string, fallback: string) => {
      for (const path of [configured, join(windowsFonts, systemName), fallback]) {
        if (!path) continue;
        try { return await readFile(path); } catch { /* try the next configured source */ }
      }
      throw new Error(`Fonte ${systemName} não encontrada.`);
    };
    try {
      [source, calibriBytes, arialBytes, arialBoldBytes] = await Promise.all([
        readFile(this.templatePath),
        readPreferredFont(process.env.REPORT_CALIBRI_FONT, 'calibri.ttf', this.calibriPath),
        readPreferredFont(process.env.REPORT_ARIAL_FONT, 'arial.ttf', this.arialPath),
        readPreferredFont(process.env.REPORT_ARIAL_BOLD_FONT, 'arialbd.ttf', this.arialBoldPath),
      ]);
    }
    catch { throw new InternalServerErrorException('Modelo ou fontes do relatório de estágio não encontrados.'); }

    const template = await PDFDocument.load(source);
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const pages = await pdf.copyPages(template, [0, 1, 2]);
    pages.forEach(page => pdf.addPage(page));
    const [calibri, arial, arialBold] = await Promise.all([
      pdf.embedFont(calibriBytes, { subset: false }),
      pdf.embedFont(arialBytes, { subset: false }),
      pdf.embedFont(arialBoldBytes, { subset: false }),
    ]);
    this.drawIdentification(pages[0], calibri, data);
    this.drawActivities(pages, arial, arialBold, data);
    return Buffer.from(await pdf.save());
  }
}
