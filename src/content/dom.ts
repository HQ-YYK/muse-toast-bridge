// DOM helpers shared by the detection modules.

export function isVisible(el: Element | null | undefined): boolean {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = window.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden";
}

export function buttonLabel(el: Element): string {
  return (
    el.getAttribute("aria-label") ||
    el.getAttribute("title") ||
    (el.textContent ?? "")
  ).trim();
}

export function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Visible elements matching a selector (browser-native query, then visibility). */
export function visibleAll(selector: string, root: ParentNode = document): Element[] {
  return Array.from(root.querySelectorAll<Element>(selector)).filter(isVisible);
}

/** All visible clickable elements, buttons and role=button alike. */
export function visibleButtons(): Element[] {
  return visibleAll('button, [role="button"]');
}

/** Visible elements for user-supplied selectors; bad selectors are skipped. */
export function visibleCustom(selectors: string[]): Element[] {
  const out: Element[] = [];
  for (const sel of selectors) {
    if (!sel) continue;
    try {
      out.push(...visibleAll(sel));
    } catch {
      // Bad selector from options: ignore, don't break the scan.
    }
  }
  return out;
}
