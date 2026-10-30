import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user?.trader) return new NextResponse("Not found", { status: 404 });
  const expense = await prisma.expense.findFirst({
    where: { id, traderId: user.trader.id },
  });
  if (!expense || expense.imageMime !== "image/jpeg") return new NextResponse("Not found", { status: 404 });
  const filename = expense.imageFilename.replace(/"/g, "") || "receipt.jpg";
  return new NextResponse(new Uint8Array(expense.imageBytes), {
    headers: {
      "Content-Type": expense.imageMime,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
