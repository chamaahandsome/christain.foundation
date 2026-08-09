// YouTube iframe-API error codes → human-readable causes.
// https://developers.google.com/youtube/iframe_api_reference#onError

export function describeYouTubeError(code: number): string {
  switch (code) {
    case 2:
      return "invalid video id/parameter";
    case 5:
      return "HTML5 player failure (often an ad blocker or privacy extension)";
    case 100:
      return "video not found (deleted or private)";
    case 101:
    case 150:
      return "embedding disabled by the channel";
    default:
      return `unknown error (${code})`;
  }
}

/** Errors that mean the video can never play here — swap to a link-out card. */
export function isFatalYouTubeError(code: number): boolean {
  return code === 100 || code === 101 || code === 150;
}
