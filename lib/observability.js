// Centralized Observability and Failure Tracking Module

function cleanField(val) {
  if (val == null) return "none";
  return String(val).replace(/[^a-zA-Z0-9_:.\-]/g, "_").slice(0, 100);
}

export function trackFailure({ component, action, id, user, error, extra = {}, isExpectedGuard = false }) {
  const safeId = cleanField(id);
  const safeComp = cleanField(component);
  const safeAct = cleanField(action);
  const safeActor = cleanField(user || "system");

  // Expected Business Guards (Rate limits, low confidence, timeouts): single-line warning, no Sentry alert
  if (isExpectedGuard) {
    console.warn(`[${safeComp}] action blocked action=${safeAct} code=${cleanField(error?.message || error)} id=${safeId} by=${safeActor}`);
    return;
  }

  // Real System Failures: structured error and alert error tracker
  console.error(`[${safeComp}] action failed action=${safeAct} id=${safeId} by=${safeActor}:`, error);

  if (global.Sentry && typeof global.Sentry.captureException === "function") {
    global.Sentry.captureException(error, {
      tags: { component: safeComp, action: safeAct, safeId, user: safeActor },
      extra
    });
  }
}

export function trackBlockedAction(component, action, details = {}) {
  const safeComp = cleanField(component);
  const safeAct = cleanField(action);
  const safeId = cleanField(details.id ?? details.reportId);
  const safeReason = cleanField(details.reason || "guard_triggered");
  const safeActor = cleanField(details.user || details.by || "system");

  console.warn(`[${safeComp}] action blocked action=${safeAct} code=${safeReason} id=${safeId} by=${safeActor}`);
}

export function reportUnhandledError(component, error, extra = {}) {
  const safeComp = cleanField(component);
  console.error(`[${safeComp}] unhandled error:`, error);

  if (global.Sentry && typeof global.Sentry.captureException === "function") {
    global.Sentry.captureException(error, {
      tags: { component: safeComp },
      extra
    });
  }
}
