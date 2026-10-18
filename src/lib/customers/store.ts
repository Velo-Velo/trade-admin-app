import type { Prisma, PrismaClient } from "@prisma/client";
import { customerEmail } from "../format";
import { customerSearchText, normalisePhone } from "./match";

export type Db = PrismaClient | Prisma.TransactionClient;

export type CustomerInput = {
  traderId: string;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  postcode?: string;
  address?: string;
};

function splitContact(input: CustomerInput): { email: string; phone: string } {
  const explicitEmail = (input.email || "").trim().toLowerCase();
  const fromContact = customerEmail(input.contact || "");
  const email = explicitEmail || fromContact || "";
  const phoneSource = input.phone || (email ? "" : input.contact || "");
  return { email, phone: normalisePhone(phoneSource) };
}

export async function findOrCreateCustomer(db: Db, input: CustomerInput) {
  const { email, phone } = splitContact(input);
  const name = input.name.trim() || "Customer";
  const postcode = (input.postcode || "").trim();
  const address = (input.address || "").trim();
  const traderId = input.traderId;

  let existing = email
    ? await db.customer.findFirst({ where: { traderId, email } })
    : null;
  if (!existing && phone) {
    existing = await db.customer.findFirst({ where: { traderId, phone } });
  }
  if (!existing && name && postcode && postcode.toLowerCase() !== "not given") {
    existing = await db.customer.findFirst({
      where: {
        traderId,
        name: { equals: name, mode: "insensitive" },
        postcode: { equals: postcode, mode: "insensitive" },
      },
    });
  }

  const fields = {
    name: existing?.name || name,
    phone: existing?.phone || phone,
    email: existing?.email || email,
    postcode: existing?.postcode || postcode,
    address: existing?.address || address,
  };
  const searchText = customerSearchText(fields);
  if (existing) {
    return db.customer.update({
      where: { id: existing.id },
      data: { ...fields, searchText },
    });
  }
  return db.customer.create({
    data: { traderId, ...fields, searchText },
  });
}
