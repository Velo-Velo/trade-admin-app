import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Current signatures only. An invalidated signature is not served, so it cannot be shown as valid. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.trader) return new NextResponse("Not found", { status: 404 });
  const { id } = await context.params;
  const signature = await prisma.ramsSignature.findFirst({
    where: { id, invalidatedAt: null, rams: { traderId: user.trader.id } },
  });
  if (!signature) return new NextResponse("Not found", { status: 404 });
  const rams = await prisma.rams.findUnique({ where: { id: signature.ramsId }, select: { contentVersion: true } });
  if (!rams || signature.contentVersion !== rams.contentVersion) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(signature.image), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
