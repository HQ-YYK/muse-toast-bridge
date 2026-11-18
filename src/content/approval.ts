// "Muse is waiting for you" detection.
//
// What we learned from the real muse.ai DOM (2026-11): the agent's decision
// card does NOT use "Allow"/"允许" buttons. Instead, when Muse finishes a run
// and asks the user to choose, it renders a list of *choice buttons* inside a
// `data-copy-exclude` block — e.g. "再派任务修 SDK 版本重编" / "先放着，明早
// 再说". Those dashed-border buttons are the "waiting for you" signal.
//
// So we detect "waiting" by the *shape* of the decision prompt rather than a
// fixed word list:
//   1. A visible button whose text is a plausible "option/decision" (non-noun,
//      action-ish) inside a `data-copy-exclude` container — Muse's decision UI.
//   2. Legacy approval-card words (Allow / 允许 / 总是允许 …) kept as a fallback.
//   3. An alert/decision dialog.
//   4. User-supplied selectors (escape hatch).
//
// The `data-copy-exclude` container is the key marker: it wraps only Muse's
// actionable decision buttons, never the streaming markdown body.

import {
  buttonLabel,
  isVisible,
  normalize,
  visibleButtons,
  visibleButtonsDeep,
} from "./dom";

const APPROVAL_WORDS = new Set([
  "approve",
  "allow",
  "confirm",
  "ask",
  "deny",
  "allow once",
  "allow for this task",
  "always allow",
  "批准",
  "允许",
  "允许一次",
  "总是允许",
  "确认",
  "审核",
  "询问",
  "拒绝",
]);

const APPROVAL_SUBSTRINGS = [
  "always allow",
  "allow for this task",
  "allow once",
  "总是允许此站点",
  "总是允许",
  "更多允许选项",
  "允许此站点",
];

/**
 * A visible `data-copy-exclude` block containing at least one *dashed-border*
 * choice button. Muse's "here are your options, pick one" prompt renders its
 * option buttons with `border-dashed` (and they sit in a `data-copy-exclude`
 * container). We require the dashed border AND at least two such buttons so a
 * single stray action button (copy/like/regenerate) or a stale historical
 * decision block doesn't false-positive.
 */
function hasDecisionPrompt(): boolean {
  const containers = document.querySelectorAll<Element>("[data-copy-exclude]");
  for (const c of Array.from(containers)) {
    if (!isVisible(c)) continue;
    const choices = c.querySelectorAll<Element>("button");
    const dashed: Element[] = [];
    for (const b of Array.from(choices)) {
      if (!isVisible(b)) continue;
      const label = normalize(buttonLabel(b));
      if (label.length === 0 || label.length > 80) continue;
      if (label === "打开标签页" || label === "打开浏览器标签页") continue;
      const cls = b.getAttribute("class") ?? "";
      if (cls.includes("border-dashed")) dashed.push(b);
    }
    // Require at least two dashed-border option buttons: Muse's decision
    // prompt always presents multiple choices, never a single button.
    if (dashed.length >= 2) return true;
  }
  return false;
}

export function findApproval(customSelectors: string[]): boolean {
  // 1. Muse decision prompt (the real-world "waiting" signal).
  if (hasDecisionPrompt()) return true;

  // 2. Legacy approval-card words, scanned across shadow DOM too.
  const buttons = [...visibleButtons(), ...visibleButtonsDeep()];
  for (const el of buttons) {
    const label = normalize(buttonLabel(el));
    if (label.length > 60) continue;
    if (APPROVAL_WORDS.has(label)) return true;
  }
  for (const el of buttons) {
    const label = normalize(buttonLabel(el));
    if (label.length > 120) continue;
    if (APPROVAL_SUBSTRINGS.some((s) => label.includes(s))) return true;
  }

  // 3. A newly appeared alert/decision dialog.
  const dialogs = document.querySelectorAll<Element>(
    '[role="alertdialog"], [role="dialog"]',
  );
  for (const el of Array.from(dialogs)) {
    if (!isVisible(el)) continue;
    return true;
  }

  // 4. User-supplied selectors (escape hatch).
  for (const sel of customSelectors) {
    if (!sel) continue;
    try {
      const el = document.querySelector<Element>(sel);
      if (el && isVisible(el)) return true;
    } catch {
      // ignore bad selector
    }
  }

  return false;
}
