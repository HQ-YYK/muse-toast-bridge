// Shared settings schema. Every value lives in chrome.storage.sync so the
// options page, popup, background worker and content script all read the
// same source of truth.

export interface Settings {
  /** Master switch. When false, nothing notifies. */
  enabled: boolean;
  /** Notify when a task finishes. */
  notifyDone: boolean;
  /** Notify when Muse waits for approval / an answer. */
  notifyApproval: boolean;
  /** Only pop when the Muse tab is not in focus. */
  onlyWhenHidden: boolean;
  /** Minimum run length (seconds) before a finish is worth a popup. */
  minWorkingSeconds: number;
  /** Extra CSS selectors that mean "Muse is working". */
  workingSelectors: string[];
  /** Extra CSS selectors / button texts that mean "Muse is waiting". */
  approvalSelectors: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  notifyDone: true,
  notifyApproval: true,
  onlyWhenHidden: true,
  minWorkingSeconds: 15,
  workingSelectors: [],
  approvalSelectors: [],
};

export type NotifyKind = "done" | "need";

export interface NotifyMessage {
  type: "toast-bridge-notify";
  kind: NotifyKind;
  title: string;
  body: string;
}

export interface TestMessage {
  type: "toast-bridge-test";
}

export type BackgroundMessage = NotifyMessage | TestMessage;
