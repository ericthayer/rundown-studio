/** Shared handling of `sample` failures for every caller (Ask Rundown, the weekly plan). */

/** No streamed text for this long counts as a stalled connection. */
export const STALL_MS = 45000;

/** Codes that mean asking can't work in this view: fall back, never re-ask. */
export const UNAVAILABLE = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed']);

/** Viewer copy per failure, and whether a manual Try again makes sense. Unknown codes read as upstream_error. */
export function failure(code: string | undefined, partial: boolean): { text: string; retry: boolean } {
  switch (code) {
    case 'rate_limited': return { text: 'Too many questions in a row. Try again in a minute.', retry: true };
    case 'session_expired': return { text: 'Your claude.ai sign-in expired. Sign in again, then try again.', retry: true };
    case 'refused': return { text: "Claude couldn't answer that one. Try asking it a different way.", retry: false };
    case 'empty_completion': return { text: 'Claude came back empty. Try a simpler question.', retry: false };
    case 'prompt_too_large': return { text: 'Too much project data to send at once. Filter the list down, then ask again.', retry: false };
    case 'stalled': return { text: 'Claude stopped responding, so this answer timed out.', retry: true };
    case 'offline': return { text: "You're offline. Ask again when you're back online.", retry: true };
    default: return { text: partial ? 'Claude became unavailable, so this answer stopped early.' : "Claude isn't available right now. Your projects are fine; only Ask is affected.", retry: true };
  }
}
