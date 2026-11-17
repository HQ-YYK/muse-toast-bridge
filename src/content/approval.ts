// Approval / "Muse is waiting for you" detection.
//
// When Muse runs a multi-step browser task it pauses and shows a decision card
// with buttons like "Allow", "Ask", "Deny", "Allow once", "Always allow",
// "Allow for this task", and site-specific text ("Always allow uploads to this
// site"). In Chinese: "允许", "允许一次", "总是允许此站点", "更多允许选项",
// "审核", "批准", "确认".
//
// We match on the whole label so ordinary buttons that merely contain a word
// don't false-positive.

import { buttonLabel, isVisible, normalize, visibleButtons } from "./dom";

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

export function findApproval(customSelectors: string[]): boolean {
  // Exact-word buttons first (case-insensitive).
  for (const el of visibleButtons()) {
    const label = normalize(buttonLabel(el));
    if (label.length > 60) continue;
    if (APPROVAL_WORDS.has(label)) return true;
  }

  // Buttons whose label *contains* a longer approval phrase (e.g. "Always
  // allow uploads to this site"). Length guard keeps false positives down.
  for (const el of visibleButtons()) {
    const label = normalize(buttonLabel(el));
    if (label.length > 120) continue;
    if (APPROVAL_SUBSTRINGS.some((s) => label.includes(s))) return true;
  }

  // A newly appeared alert/decision dialog.
  const dialogs = document.querySelectorAll<Element>(
    '[role="alertdialog"], [role="dialog"]',
  );
  for (const el of Array.from(dialogs)) {
    if (!isVisible(el)) continue;
    return true;
  }

  // User-supplied selectors (escape hatch).
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
