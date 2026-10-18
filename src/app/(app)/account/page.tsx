import { redirect } from "next/navigation";
import { Flash } from "@/components/flash";
import { buttonPrimary, buttonSecondary, inputClass, labelClass } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { firstParam } from "@/lib/format";
import { deleteAccount } from "@/server/account-actions";
import { resendVerification, signOut } from "@/server/auth-actions";

export const metadata = { title: "Account" };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const query = await searchParams;

  return (
    <div className="mx-auto grid max-w-xl gap-8">
      <div>
        <h1 className="font-serif text-4xl">Account</h1>
        <p className="mt-2 text-sm text-muted">Signed in as {user.email}</p>
      </div>
      <Flash error={firstParam(query.error)} notice={firstParam(query.notice)} />
      <section className="grid gap-3 border-t border-sand pt-6">
        <h2 className="font-serif text-2xl">Email</h2>
        <p className="text-sm leading-6">
          {user.emailVerifiedAt
            ? `Confirmed ${user.emailVerifiedAt.toLocaleDateString("en-GB")}. Quotes and invoices can be sent.`
            : "Not confirmed yet. Quotes and invoices stay on your side until you open the confirmation link."}
        </p>
        {user.emailVerifiedAt ? null : (
          <form action={resendVerification}>
            <button className={buttonSecondary} type="submit">Send confirmation link</button>
          </form>
        )}
        <p className="text-sm leading-6 text-muted">
          To set a new password, use “Email me a password link” on the sign-in page.
        </p>
      </section>
      <section className="grid gap-3 border-t border-sand pt-6">
        <h2 className="font-serif text-2xl">Your data</h2>
        <p className="text-sm leading-6 text-muted">
          Download a JSON file of this account. Photos are listed by name. The file does not include the photo bytes or your password.
        </p>
        <a className={buttonSecondary} href="/api/account/export">Download my data</a>
      </section>
      <section className="grid gap-3 border-t border-sand pt-6">
        <h2 className="font-serif text-2xl">Delete account</h2>
        <p className="text-sm leading-6 text-muted">
          This deletes the account and the quotes, invoices, customers, jobs and photos stored for it. It cannot be undone.
        </p>
        <form action={deleteAccount} className="grid gap-3">
          <label className={labelClass}>
            Type {user.email} to confirm
            <input className={inputClass} name="confirmEmail" type="email" autoComplete="off" required />
          </label>
          <button className={buttonPrimary} type="submit">Delete account</button>
        </form>
      </section>
      <form action={signOut}>
        <button className={buttonSecondary} type="submit">Sign out</button>
      </form>
    </div>
  );
}
