// Comment rules (pure, tested). Post-moderation model: comments publish
// immediately (APPROVED) and the moderation queue acts on what's live —
// safety/abuse, distinct from the doctrine audit (§5.4).

export const MAX_COMMENT_LENGTH = 2000;

export interface CommentCheck {
  ok: boolean;
  error?: string;
}

export function validateCommentBody(body: string): CommentCheck {
  const trimmed = body.trim();
  if (trimmed.length < 2) {
    return { ok: false, error: "Say something — a comment needs at least 2 characters." };
  }
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    return {
      ok: false,
      error: `Comments can be at most ${MAX_COMMENT_LENGTH} characters.`,
    };
  }
  return { ok: true };
}
