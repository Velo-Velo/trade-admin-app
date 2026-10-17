import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user?.trader) return new NextResponse("Not found", { status: 404 });
  const photo = await prisma.enquiryPhoto.findFirst({
    where: { id, enquiry: { traderId: user.trader.id } },
  });
  if (!photo || !ALLOWED.has(photo.mimeType)) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(photo.bytes), {
    headers: {
      "Content-Type": photo.mimeType,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="${photo.filename.replace(/"/g, "")}"`,
    },
  });
}
