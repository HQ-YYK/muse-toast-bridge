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

/** All visible clickable elements, buttons and role=button alike. */
export function visibleButtons(): Element[] {
  const nodes = document.querySelectorAll<Element>('button, [role="button"]');
  return Array.from(nodes).filter(isVisible);
}

export function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}
