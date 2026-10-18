import { redirect } from "next/navigation";

export default function NewInvoiceRedirect() {
  redirect("/invoices");
}
