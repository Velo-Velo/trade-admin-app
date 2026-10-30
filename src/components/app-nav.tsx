"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import { linkIsActive, onNavKey, sectionForPath, visibleSections, type NavFocus, type NavSection } from "@/lib/nav";

export function AppNav({ slug, showSimulator }: { slug: string; showSimulator: boolean }) {
  const pathname = usePathname();
  const sections = visibleSections(showSimulator);
  const current = sectionForPath(pathname, sections);
  const [openId, setOpenId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const focusRequest = useRef<NavFocus | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  const mobileId = useId();

  useEffect(() => {
    setOpenId(null);
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!headerRef.current?.contains(event.target as Node)) {
        setOpenId(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  useEffect(() => {
    const target = focusRequest.current;
    if (!target || !headerRef.current) return;
    focusRequest.current = null;
    if (target.kind === "section") {
      headerRef.current.querySelector<HTMLButtonElement>(`[data-nav-section="${target.sectionId}"]`)?.focus();
      return;
    }
    const links = headerRef.current.querySelectorAll<HTMLAnchorElement>(`[data-nav-panel="${target.sectionId}"] a`);
    links[target.index]?.focus();
  }, [focusTick, openId]);

  function requestFocus(target: NavFocus) {
    focusRequest.current = target;
    setFocusTick((value) => value + 1);
  }

  function onSectionKey(event: KeyboardEvent<HTMLButtonElement>, section: NavSection) {
    const result = onNavKey({
      key: event.key,
      openId,
      focus: { kind: "section", sectionId: section.id },
      sectionIds: sections.map((item) => item.id),
      linkCount: section.links.length,
    });
    if (!result.handled) return;
    event.preventDefault();
    setOpenId(result.openId);
    requestFocus(result.focus);
  }

  function onLinkKey(event: KeyboardEvent<HTMLAnchorElement>, section: NavSection, index: number) {
    const result = onNavKey({
      key: event.key,
      openId,
      focus: { kind: "link", sectionId: section.id, index },
      sectionIds: sections.map((item) => item.id),
      linkCount: section.links.length,
    });
    if (!result.handled) return;
    event.preventDefault();
    setOpenId(result.openId);
    requestFocus(result.focus);
  }

  function onHeaderKey(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape") return;
    if (mobileOpen) {
      setMobileOpen(false);
      menuButtonRef.current?.focus();
    }
    if (openId) {
      const id = openId;
      setOpenId(null);
      requestFocus({ kind: "section", sectionId: id });
    }
  }

  return (
    <header ref={headerRef} className="border-b border-sand bg-card" onKeyDown={onHeaderKey}>
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <a href="/dashboard" className="font-serif text-2xl tracking-tight text-ink no-underline">
          Quotestick
        </a>
        <div className="flex items-center gap-2">
          <a href={`/t/${slug}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-pine">
            View your page
          </a>
          <button
            ref={menuButtonRef}
            type="button"
            className="rounded-full px-3 py-2 text-sm font-semibold text-ink md:hidden"
            aria-expanded={mobileOpen}
            aria-controls={mobileId}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? "Close" : "Menu"}
          </button>
        </div>
      </div>
      <nav aria-label="Account" className="mx-auto hidden max-w-5xl flex-wrap gap-1 px-4 pb-3 md:flex">
        {sections.map((section) => {
          const open = openId === section.id;
          const sectionActive = current?.id === section.id;
          const panelId = `nav-panel-${section.id}`;
          return (
            <div key={section.id} className="relative">
              <button
                type="button"
                data-nav-section={section.id}
                className={`rounded-full px-3 py-2 text-sm font-semibold ${
                  sectionActive ? "bg-pine text-white" : open ? "bg-paper text-ink" : "text-muted hover:bg-paper hover:text-ink"
                }`}
                aria-expanded={open}
                aria-controls={panelId}
                aria-current={sectionActive ? "location" : undefined}
                onClick={() => setOpenId(open ? null : section.id)}
                onKeyDown={(event) => onSectionKey(event, section)}
              >
                {section.label}
              </button>
              {open ? (
                <ul
                  id={panelId}
                  data-nav-panel={section.id}
                  className={`absolute top-full z-20 mt-1 min-w-44 border border-sand bg-white py-1 shadow-card ${
                    section.id === sections[sections.length - 1]?.id ? "right-0" : "left-0"
                  }`}
                >
                  {section.links.map((link, index) => {
                    const active = linkIsActive(pathname, link.href);
                    return (
                      <li key={link.href}>
                        <a
                          href={link.href}
                          className={`block px-3 py-2 text-sm font-semibold no-underline ${
                            active ? "bg-pine text-white" : "text-ink hover:bg-paper"
                          }`}
                          aria-current={active ? "page" : undefined}
                          onKeyDown={(event) => onLinkKey(event, section, index)}
                        >
                          {link.label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </nav>
      {mobileOpen ? (
        <nav id={mobileId} aria-label="Account" className="border-t border-sand px-4 py-2 md:hidden">
          {sections.map((section) => {
            const sectionActive = current?.id === section.id;
            return (
              <section key={section.id} className="border-b border-sand py-3 last:border-b-0" aria-labelledby={`nav-mobile-${section.id}`}>
                <h2
                  id={`nav-mobile-${section.id}`}
                  className={`text-xs font-semibold uppercase tracking-wide ${sectionActive ? "text-pine" : "text-muted"}`}
                >
                  {section.label}
                </h2>
                <ul className="mt-1">
                  {section.links.map((link) => {
                    const active = linkIsActive(pathname, link.href);
                    return (
                      <li key={link.href}>
                        <a
                          href={link.href}
                          className={`block rounded-full px-3 py-2 text-sm font-semibold no-underline ${
                            active ? "bg-pine text-white" : "text-ink"
                          }`}
                          aria-current={active ? "page" : undefined}
                        >
                          {link.label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </nav>
      ) : null}
    </header>
  );
}
