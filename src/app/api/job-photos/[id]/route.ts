import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user?.trader) return new NextResponse("Not found", { status: 404 });
  const photo = await prisma.jobPhoto.findFirst({
    where: { id, job: { traderId: user.trader.id } },
  });
  if (!photo || photo.mimeType !== "image/jpeg") return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(photo.bytes), {
    headers: {
      "Content-Type": photo.mimeType,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="${photo.filename.replace(/"/g, "")}"`,
    },
  });
}
