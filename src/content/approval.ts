// "Muse is waiting for you" detection.
//
// What we learned from the real muse.ai DOM (2026-11): when Muse asks the user
// to choose, it renders dashed-border choice buttons (`border-dashed`) inside a
// `data-copy-exclude` block, e.g. "再派任务修 SDK 版本重编" / "先放着，明早再说".
//
// This module returns *candidate elements*. Answered prompts stay in the chat
// history, so the caller only notifies for elements it has not seen before.
//
// Candidates:
//   1. A `data-copy-exclude` block with >= 2 dashed-border choice buttons.
//   2. A button whose label is an allow-type approval word (Allow / 允许 ...).
//      Generic words like Confirm / Ask / Deny / 确认 are left out on purpose:
//      they appear on ordinary dialogs and menus all over the page.
//   3. User-supplied selectors (escape hatch).

import { buttonLabel, normalize, visibleAll, visibleButtons, visibleCustom } from "./dom";

const APPROVAL_WORDS = new Set([
  "approve",
  "allow",
  "allow once",
  "always allow",
  "allow for this task",
  "批准",
  "允许",
  "允许一次",
  "总是允许",
]);

const APPROVAL_SUBSTRINGS = [
  "always allow",
  "allow for this task",
  "allow once",
  "总是允许",
  "允许此站点",
  "更多允许选项",
];

const NON_CHOICE_LABELS = new Set(["打开标签页", "打开浏览器标签页"]);

function decisionBlocks(): Element[] {
  const out: Element[] = [];
  for (const block of visibleAll("[data-copy-exclude]")) {
    let dashed = 0;
    for (const b of visibleAll('button[class*="border-dashed"]', block)) {
      const label = normalize(buttonLabel(b));
      if (label.length === 0 || label.length > 80) continue;
      if (NON_CHOICE_LABELS.has(label)) continue;
      dashed++;
    }
    // Muse's decision prompt always offers several choices, never one.
    if (dashed >= 2) out.push(block);
  }
  return out;
}

function approvalButtons(): Element[] {
  return visibleButtons().filter((el) => {
    const label = normalize(buttonLabel(el));
    if (label.length > 60) return false;
    return APPROVAL_WORDS.has(label) || APPROVAL_SUBSTRINGS.some((s) => label.includes(s));
  });
}

export function approvalCandidates(customSelectors: string[]): Element[] {
  return [...decisionBlocks(), ...approvalButtons(), ...visibleCustom(customSelectors)];
}
