import type { PrismaClient } from "@prisma/client";
import { PLUMBING_TEMPLATES } from "./plumbing";

export async function seedJobTemplates(prisma: PrismaClient): Promise<number> {
  for (const template of PLUMBING_TEMPLATES) {
    const row = await prisma.jobTemplate.upsert({
      where: { slug: template.slug },
      create: {
        trade: template.trade,
        slug: template.slug,
        name: template.name,
        summary: template.summary,
        keywords: template.keywords.join(", "),
      },
      update: {
        trade: template.trade,
        name: template.name,
        summary: template.summary,
        keywords: template.keywords.join(", "),
      },
    });
    await prisma.jobTemplateLine.deleteMany({ where: { templateId: row.id } });
    await prisma.jobTemplateLine.createMany({
      data: template.lines.map((line, index) => ({
        templateId: row.id,
        kind: line.kind,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        starterPricePence: line.unitPricePence,
        sortOrder: index,
      })),
    });
  }
  return PLUMBING_TEMPLATES.length;
}
