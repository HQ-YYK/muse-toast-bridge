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

/**
 * Walk the document *and every shadow root* collecting clickable elements.
 * Muse's decision cards may render inside a shadow DOM (or web component), which
 * the plain `document.querySelectorAll` in `visibleButtons` cannot see. This is
 * the most common reason a Muse approval button goes undetected.
 */
export function visibleButtonsDeep(): Element[] {
  const out: Element[] = [];
  const seen = new Set<Element>();

  const collect = (root: Document | ShadowRoot) => {
    const nodes = root.querySelectorAll<Element>('button, [role="button"]');
    for (const el of Array.from(nodes)) {
      if (seen.has(el)) continue;
      seen.add(el);
      if (isVisible(el)) out.push(el);
    }
    // Recurse into shadow roots of any element that has one.
    for (const host of Array.from(root.querySelectorAll<Element>("*"))) {
      if (host.shadowRoot) collect(host.shadowRoot);
    }
  };

  collect(document);
  return out;
}

/**
 * True if the element (or any ancestor host) is inside a shadow root. Used to
 * know whether we found something the plain query would have missed.
 */
export function isInShadowDom(el: Element): boolean {
  let node: Node | null = el;
  while (node) {
    if (node instanceof ShadowRoot) return true;
    node = node.parentNode;
  }
  return false;
}

export function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}
