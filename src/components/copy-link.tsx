"use client";

import { useState } from "react";
import { buttonSecondary } from "@/components/styles";

export function CopyLink({ href }: { href: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonSecondary}
      onClick={async () => {
        await navigator.clipboard.writeText(href);
        setCopied(true);
      }}
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
