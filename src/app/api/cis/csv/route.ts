import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { billingConfigured, featureAllowed, upgradeMessage } from "@/lib/billing/plans";
import { loadCisStatement } from "@/lib/cis/load";
import { statementCsv } from "@/lib/cis/statement";
import { isSandboxTrader } from "@/lib/sandbox";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user?.trader) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const sandbox = isSandboxTrader({ slug: user.trader.slug, email: user.email });
  if (!featureAllowed({ plan: user.trader.plan, feature: "cis", sandbox, billingOn: billingConfigured() })) {
    return NextResponse.json({ error: upgradeMessage("cis") }, { status: 403 });
  }
  const year = new URL(request.url).searchParams.get("year") ?? undefined;
  const statement = await loadCisStatement(user.trader.id, year);
  const body = statementCsv({
    businessName: user.trader.businessName,
    utr: user.trader.cisUtr,
    taxYearLabel: statement.taxYear.label,
    rows: statement.rows,
  });
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cis-${statement.taxYear.label.replace("/", "-")}.csv"`,
    },
  });
}
