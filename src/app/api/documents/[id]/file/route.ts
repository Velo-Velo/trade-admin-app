import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPrivateObject } from "@/lib/storage/object";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.trader) return new NextResponse("Not found", { status: 404 });
  const { id } = await context.params;
  const document = await prisma.companyDocument.findFirst({ where: { id, traderId: user.trader.id } });
  if (!document || (!document.fileBytes && !document.storageKey)) return new NextResponse("Not found", { status: 404 });
  const bytes = document.storageKey ? await getPrivateObject(document.storageKey) : new Uint8Array(document.fileBytes ?? []);
  const download = new URL(request.url).searchParams.get("download") === "1";
  const filename = (document.fileName || "document").replace(/"/g, "");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": document.fileMime || "application/octet-stream",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
    },
  });
}
