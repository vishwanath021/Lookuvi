export const GUEST_JOB_POLL_MS = 1500;

export const GUEST_PREVIEW_FAILED = "The preview did not finish. It was not started again.";

export function guestJobFailureMessage(job: { status?: string; message?: string } | null | undefined) {
  if (!job) return "";
  if (job.status !== "FAILED" && job.status !== "UNCERTAIN") return "";
  const message = (job.message || "").trim();
  return message || GUEST_PREVIEW_FAILED;
}

async function readJob(fetchImpl: typeof fetch, slug: string, requestId: string, signal?: AbortSignal) {
  const res = await fetchImpl(`/api/v1/tryon/jobs?slug=${encodeURIComponent(slug)}&requestId=${encodeURIComponent(requestId)}`, { signal });
  if (!res.ok) return null;
  return (await res.json()) as { status?: string; message?: string };
}

/**
 * POST /api/v1/tryon/generate and watch the GenerationJob.
 * When the row is FAILED or UNCERTAIN, the POST is aborted and the job message is returned as JSON.
 */
export async function postGuestGenerate(args: {
  slug: string;
  body: FormData;
  requestId: string;
  fetchImpl?: typeof fetch;
  pollMs?: number;
}) {
  const fetchImpl = args.fetchImpl ?? fetch;
  const pollMs = args.pollMs ?? GUEST_JOB_POLL_MS;
  const postAbort = new AbortController();
  const pollAbort = new AbortController();
  let stopped = false;
  let failure = "";
  const watch = (async () => {
    while (!stopped && !failure) {
      await new Promise((resolve) => setTimeout(resolve, pollMs));
      if (stopped || failure) return;
      try {
        const job = await readJob(fetchImpl, args.slug, args.requestId, pollAbort.signal);
        const message = guestJobFailureMessage(job);
        if (!message) continue;
        failure = message;
        postAbort.abort();
        return;
      } catch {
        if (pollAbort.signal.aborted || stopped) return;
      }
    }
  })();
  try {
    return await fetchImpl("/api/v1/tryon/generate", { method: "POST", body: args.body, signal: postAbort.signal });
  } catch (error) {
    if (!failure) {
      try {
        failure = guestJobFailureMessage(await readJob(fetchImpl, args.slug, args.requestId));
      } catch {
        failure = "";
      }
    }
    if (failure) {
      return new Response(JSON.stringify({ error: "PREVIEW", message: failure }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }
    throw error;
  } finally {
    stopped = true;
    pollAbort.abort();
    void watch.catch(() => undefined);
  }
}
