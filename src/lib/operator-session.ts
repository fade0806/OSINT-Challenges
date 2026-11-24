export const OPERATOR_SESSION_EVENT = "sp-operator-session";

export function publishOperatorSession(unlocked: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPERATOR_SESSION_EVENT, { detail: { unlocked } }));
}
