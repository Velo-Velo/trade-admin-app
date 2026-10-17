import { redirect } from "next/navigation";
import { buttonSecondary } from "@/components/styles";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/server/auth-actions";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto grid max-w-xl gap-4">
      <h1 className="font-serif text-4xl">Account</h1>
      <p className="text-sm text-muted">Signed in as {user.email}</p>
      <p className="text-sm leading-6 text-muted">
        If you forget the password, use “Email me a sign-in link” on the sign-in page. Card payments, email sending and the language model are optional and only run when their keys are set.
      </p>
      <form action={signOut}>
        <button className={buttonSecondary} type="submit">
          Sign out
        </button>
      </form>
    </div>
  );
}
