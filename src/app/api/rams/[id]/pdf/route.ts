import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { renderRamsPdf } from "@/lib/rams/pdf";
import { withCurrentSignatures } from "@/lib/rams/pdf-data";
import { ramsInclude, toPdfInput } from "@/lib/rams/store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.trader) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const { id } = await context.params;
  const rams = await prisma.rams.findFirst({
    where: { id, traderId: user.trader.id },
    include: ramsInclude,
  });
  if (!rams) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const pdf = await renderRamsPdf(await withCurrentSignatures(prisma, rams.id, rams.contentVersion, toPdfInput(rams, user.trader)));
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${rams.number}.pdf"`,
    },
  });
}
