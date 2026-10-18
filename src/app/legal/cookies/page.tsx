export const metadata = { title: "Cookies" };

export default function CookiesPage() {
  return (
    <article className="grid gap-4 leading-7">
      <h1 className="font-serif text-4xl tracking-tight">Cookies</h1>
      <p>Quotestick sets one cookie, <span className="font-semibold">qs_session</span>, so you stay signed in. It is essential. There is no advertising cookie and no analytics cookie in this build.</p>
      <p>The public quote, invoice and trader pages do not need that cookie. If you are not signed in, they do not set one.</p>
    </article>
  );
}
