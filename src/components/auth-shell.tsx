export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,0.85fr)_minmax(22rem,1fr)]">
      <aside className="hidden flex-col justify-between bg-[#16181d] px-10 py-12 text-white lg:flex">
        <a href="/" className="font-serif text-2xl tracking-tight text-white no-underline">
          Quotestick
        </a>
        <div className="max-w-sm">
          <p className="font-serif text-4xl leading-tight tracking-tight">Send a quote from the van.</p>
          <p className="mt-4 text-lg leading-7 text-white/75">
            Get paid before you leave the drive. The customer sees nothing until you approve it.
          </p>
        </div>
        <p className="text-sm text-white/50">Working name. Not legal or tax advice.</p>
      </aside>
      <div className="px-5 py-8 sm:px-10">
        <a href="/" className="font-serif text-2xl tracking-tight no-underline lg:hidden">
          Quotestick
        </a>
        {children}
      </div>
    </div>
  );
}
