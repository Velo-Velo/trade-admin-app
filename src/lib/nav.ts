/**
 * Signed-in navigation.
 * Add a page by appending a link to the right section. Diary sits with Work.
 * CIS records sit with Money. A link marked `when: "simulator"` shows only
 * on the sample account.
 */

export type NavLink = {
  href: string;
  label: string;
  when?: "simulator";
};

export type NavSection = {
  id: string;
  label: string;
  links: NavLink[];
};

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    id: "work",
    label: "Work",
    links: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/enquiries", label: "Enquiries" },
      { href: "/quotes", label: "Quotes" },
      { href: "/follow-ups", label: "Follow-ups" },
      { href: "/jobs", label: "Jobs" },
      { href: "/diary", label: "Diary" },
    ],
  },
  {
    id: "money",
    label: "Money",
    links: [
      { href: "/invoices", label: "Invoices" },
      { href: "/receipts", label: "Receipts" },
      { href: "/price-book", label: "Price book" },
      { href: "/cis", label: "CIS records" },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    links: [
      { href: "/customers", label: "Customers" },
      { href: "/rams", label: "RAMS" },
      { href: "/checklist", label: "Checklist" },
    ],
  },
  {
    id: "account",
    label: "Account",
    links: [
      { href: "/business", label: "Your page" },
      { href: "/billing", label: "Plans" },
      { href: "/account", label: "Account" },
      { href: "/whatsapp", label: "WhatsApp", when: "simulator" },
    ],
  },
];

export function linkIsActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function visibleSections(showSimulator: boolean): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    links: section.links.filter((link) => showSimulator || link.when !== "simulator"),
  })).filter((section) => section.links.length > 0);
}

export function sectionForPath(pathname: string, sections: readonly NavSection[]): NavSection | null {
  return sections.find((section) => section.links.some((link) => linkIsActive(pathname, link.href))) ?? null;
}

export type NavFocus =
  | { kind: "section"; sectionId: string }
  | { kind: "link"; sectionId: string; index: number };

/** Keyboard movement for the desktop section menus. Tab is left to the browser. */
export function onNavKey(input: {
  key: string;
  openId: string | null;
  focus: NavFocus;
  sectionIds: string[];
  linkCount: number;
}): { openId: string | null; focus: NavFocus; handled: boolean } {
  const { key, focus, sectionIds } = input;
  const sectionIndex = Math.max(0, sectionIds.indexOf(focus.sectionId));
  const stepSection = (delta: number) => sectionIds[(sectionIndex + delta + sectionIds.length) % sectionIds.length];

  if (key === "Escape") {
    if (!input.openId) return { openId: input.openId, focus, handled: false };
    return { openId: null, focus: { kind: "section", sectionId: focus.sectionId }, handled: true };
  }

  if (focus.kind === "section") {
    if (key === "ArrowRight" || key === "ArrowLeft") {
      const id = stepSection(key === "ArrowRight" ? 1 : -1);
      return { openId: input.openId ? id : null, focus: { kind: "section", sectionId: id }, handled: true };
    }
    if (key === "Home" || key === "End") {
      const id = key === "Home" ? sectionIds[0] : sectionIds[sectionIds.length - 1];
      return { openId: input.openId ? id : null, focus: { kind: "section", sectionId: id }, handled: true };
    }
    if (key === "ArrowDown" || key === "ArrowUp") {
      const index = key === "ArrowDown" ? 0 : Math.max(0, input.linkCount - 1);
      return { openId: focus.sectionId, focus: { kind: "link", sectionId: focus.sectionId, index }, handled: true };
    }
    return { openId: input.openId, focus, handled: false };
  }

  const count = input.linkCount;
  if (key === "ArrowDown") {
    const index = count === 0 ? 0 : (focus.index + 1) % count;
    return { openId: focus.sectionId, focus: { kind: "link", sectionId: focus.sectionId, index }, handled: true };
  }
  if (key === "ArrowUp") {
    if (focus.index <= 0) {
      return { openId: focus.sectionId, focus: { kind: "section", sectionId: focus.sectionId }, handled: true };
    }
    return { openId: focus.sectionId, focus: { kind: "link", sectionId: focus.sectionId, index: focus.index - 1 }, handled: true };
  }
  if (key === "Home") {
    return { openId: focus.sectionId, focus: { kind: "link", sectionId: focus.sectionId, index: 0 }, handled: true };
  }
  if (key === "End") {
    return { openId: focus.sectionId, focus: { kind: "link", sectionId: focus.sectionId, index: Math.max(0, count - 1) }, handled: true };
  }
  if (key === "ArrowRight" || key === "ArrowLeft") {
    const id = stepSection(key === "ArrowRight" ? 1 : -1);
    return { openId: id, focus: { kind: "section", sectionId: id }, handled: true };
  }
  return { openId: input.openId, focus, handled: false };
}
