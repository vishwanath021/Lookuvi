import sharp from "sharp";
import { BilledProviderError, UnbilledProviderError, UncertainBillingError, UnknownModelError } from "@/lib/ai/errors";
import { buildFalEditBody, falModel, type Flux3Resolution } from "@/lib/ai/fal-models";
import type { EditSize } from "@/lib/ai/edit-request";
import { numberEnv } from "@/lib/env";
import { logInfo, logProviderFailure, scrubProviderBody } from "@/lib/logger";

const QUEUE_ORIGIN = "https://queue.fal.run";
const REST_ORIGIN = "https://rest.fal.ai";

/** fal retries a failed queue request up to 10 times. This header turns that off. */
export function falSubmitHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Key ${apiKey}`,
    "Content-Type": "application/json",
    "X-Fal-No-Retry": "1",
  };
}

function scrub(text: string) {
  return text.replace(/sk-[A-Za-z0-9_\-]{8,}/g, "sk-[redacted]").replace(/AIza[0-9A-Za-z\-_]{8,}/g, "AIza[redacted]").replace(/Key\s+[^\s"]+/gi, "Key [redacted]").slice(0, 400);
}

function sameOrigin(url: string, origin: string) {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

/** Queue routes live on the app id (owner/name), not a nested endpoint path. */
export function falQueueAppId(endpointId: string) {
  const [owner, app] = endpointId.split("/").filter(Boolean);
  if (!owner || !app) return endpointId;
  return `${owner}/${app}`;
}

function uniqueUrls(urls: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/**
 * Status URLs to try, in order.
 * The queue guide says to use the submit response, and otherwise only owner/app
 * (`meta/muse-image`), because a path that still contains the endpoint (`/edit`) returns 405.
 * The model OpenAPI lists the full id, so that path is the next try when owner/app is refused.
 */
export function falQueueStatusCandidates(endpointId: string, requestId: string, returned?: string) {
  const app = `${QUEUE_ORIGIN}/${falQueueAppId(endpointId)}/requests/${requestId}/status`;
  const full = `${QUEUE_ORIGIN}/${endpointId}/requests/${requestId}/status`;
  return uniqueUrls([acceptedQueueUrl(returned, requestId), app, full]);
}

/**
 * Result URLs to try, in order.
 * The queue guide fetches `/{owner}/{app}/requests/{request_id}` with no `/response` suffix.
 * `/response` is only a last try for gateways that still publish that alias.
 */
export function falQueueResultCandidates(endpointId: string, requestId: string, returned?: string) {
  const app = `${QUEUE_ORIGIN}/${falQueueAppId(endpointId)}/requests/${requestId}`;
  const full = `${QUEUE_ORIGIN}/${endpointId}/requests/${requestId}`;
  const legacy = `${QUEUE_ORIGIN}/${falQueueAppId(endpointId)}/requests/${requestId}/response`;
  return uniqueUrls([acceptedQueueUrl(returned, requestId), app, full, legacy]);
}

/**
 * Use the URL fal returned when it is on queue.fal.run and names this request.
 * A nested endpoint's status_url is shorter than the submit path, so it must not be rebuilt from the full id.
 */
export function acceptedQueueUrl(raw: string | undefined, requestId: string) {
  if (!raw || !requestId || !sameOrigin(raw, QUEUE_ORIGIN)) return "";
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return "";
  }
  if (!parsed.pathname.includes(`/requests/${requestId}`)) return "";
  if (parsed.pathname.endsWith("/cancel")) return "";
  return parsed.toString();
}

function withLogs(url: string) {
  const parsed = new URL(url);
  if (!parsed.searchParams.has("logs")) parsed.searchParams.set("logs", "1");
  return parsed.toString();
}

type StatusBody = {
  status?: string;
  response_url?: string;
  error?: string;
  error_type?: string;
  logs?: { message?: string }[];
};

function statusDetail(status: StatusBody) {
  const logs = Array.isArray(status.logs)
    ? status.logs.map((entry) => entry?.message || "").filter(Boolean).slice(-3).join(" | ")
    : "";
  return scrub([status.error_type, status.error, logs].filter(Boolean).join(" — "));
}

async function imageLooksBlocked(bytes: Buffer, nsfw?: boolean[]) {
  const stats = await sharp(bytes, { failOn: "none" }).stats();
  const mean = stats.channels.reduce((sum, channel) => sum + channel.mean, 0) / Math.max(1, stats.channels.length);
  const black = mean < 8;
  const flagged = Array.isArray(nsfw) && nsfw.some(Boolean);
  return black || flagged;
}

type FetchImpl = typeof fetch;

/** Longest edge sent to fal. A 1024px PNG upload was most of the wait before the queue even started. */
export const FAL_UPLOAD_LONG_SIDE = 768;

/**
 * Status used to be read every 2000ms, so a finished job could sit unnoticed for that long.
 * In progress we look again after 800ms. In the queue, 1200ms.
 */
export function falPollDelayMs(status?: string) {
  if (status === "IN_PROGRESS") return 800;
  if (status === "IN_QUEUE") return 1200;
  return 1000;
}

export async function prepareFalUpload(bytes: Buffer) {
  const meta = await sharp(bytes, { failOn: "none" }).rotate().metadata();
  const long = Math.max(meta.width || 0, meta.height || 0);
  let pipeline = sharp(bytes, { failOn: "none" }).rotate();
  if (long > FAL_UPLOAD_LONG_SIDE) {
    pipeline = pipeline.resize({
      width: FAL_UPLOAD_LONG_SIDE,
      height: FAL_UPLOAD_LONG_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  const jpeg = await pipeline.jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  const after = await sharp(jpeg, { failOn: "none" }).metadata();
  return {
    bytes: jpeg,
    width: after.width || meta.width || 0,
    height: after.height || meta.height || 0,
    beforeBytes: bytes.length,
    afterBytes: jpeg.length,
  };
}

/** One queue request is polled for this long. Default is one hour. FAL_TIMEOUT_MS overrides the older FAL_QUEUE_DEADLINE_MS. */
export function falTimeoutMs() {
  const named = process.env.FAL_TIMEOUT_MS;
  if (named != null && named !== "") {
    const value = Number(named);
    if (Number.isFinite(value) && value >= 0) return value;
  }
  return numberEnv("FAL_QUEUE_DEADLINE_MS", 3_600_000);
}

async function uploadOne(args: {
  fetchImpl: FetchImpl;
  apiKey: string;
  bytes: Buffer;
  fileName: string;
  contentType: string;
}) {
  let initiate: Response;
  try {
    initiate = await args.fetchImpl(`${REST_ORIGIN}/storage/upload/initiate?storage_type=fal-cdn-v3`, {
      method: "POST",
      headers: {
        Authorization: `Key ${args.apiKey}`,
        "Content-Type": "application/json",
        "X-Fal-Object-Lifecycle-Preference": JSON.stringify({ expiration_duration_seconds: 3600 }),
      },
      body: JSON.stringify({ file_name: args.fileName, content_type: args.contentType }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new UnbilledProviderError("The fal upload did not start. No edit was submitted.");
  }
  if (initiate.status === 401 || initiate.status === 403) {
    throw new UnbilledProviderError("fal rejected the key before an edit was submitted.");
  }
  if (!initiate.ok) throw new UnbilledProviderError("The fal upload was refused. No edit was submitted.");
  const payload = (await initiate.json()) as { upload_url?: string; file_url?: string };
  if (!payload.upload_url || !payload.file_url || !payload.upload_url.startsWith("https://") || !payload.file_url.startsWith("https://")) {
    throw new UnbilledProviderError("fal did not return an upload URL. No edit was submitted.");
  }
  let put: Response;
  try {
    put = await args.fetchImpl(payload.upload_url, {
      method: "PUT",
      headers: { "Content-Type": args.contentType },
      body: new Uint8Array(args.bytes),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new UnbilledProviderError("The fal upload did not finish. No edit was submitted.");
  }
  if (!put.ok) throw new UnbilledProviderError("The fal upload was refused. No edit was submitted.");
  return payload.file_url;
}

/**
 * One queue submit, then poll. X-Fal-No-Retry is always sent.
 * A timeout after the submit is an unknown bill. The submit is not repeated.
 * Input CDN files are not deleted: the payloads API leaves input files in place. The upload sets a 1 hour expiry instead.
 */
export async function postFalReferenceEdit(args: {
  apiKey: string;
  endpointId: string;
  prompt: string;
  selfiePng: Buffer;
  referenceJpeg: Buffer;
  size: EditSize;
  estimateUsd: number;
  /** flux-3 resolution. Omitted calls stay at 1k. */
  resolution?: Flux3Resolution;
  fetchImpl?: FetchImpl;
  now?: () => number;
  deadlineMs?: number;
  sleep?: (ms: number) => Promise<void>;
}) {
  const row = falModel(args.endpointId);
  if (!row) throw new UnknownModelError(`${args.endpointId} is not a configured fal edit. No other model was called.`);
  const fetchImpl = args.fetchImpl ?? fetch;
  const now = args.now ?? Date.now;
  const deadlineMs = args.deadlineMs ?? falTimeoutMs();
  const sleep = args.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const selfieUpload = await prepareFalUpload(args.selfiePng);
  const referenceUpload = await prepareFalUpload(args.referenceJpeg);
  const selfieUrl = await uploadOne({ fetchImpl, apiKey: args.apiKey, bytes: selfieUpload.bytes, fileName: "selfie.jpg", contentType: "image/jpeg" });
  const referenceUrl = await uploadOne({ fetchImpl, apiKey: args.apiKey, bytes: referenceUpload.bytes, fileName: "style-reference.jpg", contentType: "image/jpeg" });
  const body = buildFalEditBody(row.id, {
    prompt: args.prompt,
    selfieUrl,
    referenceUrl,
    size: args.size,
    width: selfieUpload.width,
    height: selfieUpload.height,
    resolution: args.resolution,
  });
  if (!body) throw new UnknownModelError(`${row.id} is not a configured fal edit. No other model was called.`);
  const started = now();
  const deadline = started + deadlineMs;
  let submitted = false;
  let requestId = "";
  let statusCandidates: string[] = [];
  let resultCandidates: string[] = [];
  const loggedHttp = new Set<string>();
  const noteHttp = (phase: string, status: number, body: string) => {
    const key = `${phase}:${status}`;
    if (loggedHttp.has(key) || loggedHttp.size >= 4) return;
    loggedHttp.add(key);
    logProviderFailure({ provider: "fal", model: row.id, httpStatus: status, body, requestId });
  };
  try {
    const response = await fetchImpl(`${QUEUE_ORIGIN}/${row.id}`, {
      method: "POST",
      headers: falSubmitHeaders(args.apiKey),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    submitted = true;
    const text = await response.text();
    if (response.status === 401 || response.status === 403) {
      noteHttp("submit", response.status, text);
      throw new UnbilledProviderError("fal rejected the key. The edit was not accepted.");
    }
    let payload: { request_id?: string; status_url?: string; response_url?: string; error?: string } = {};
    try {
      payload = JSON.parse(text) as typeof payload;
    } catch {
      payload = {};
    }
    if (!response.ok || !payload.request_id) {
      noteHttp("submit", response.status, text);
      if (response.status >= 400 && response.status < 500) {
        throw new UnbilledProviderError(scrubProviderBody(payload.error || text) || "fal refused the edit before it was queued.");
      }
      throw new UncertainBillingError("fal did not confirm the queue request. It was not submitted again.");
    }
    requestId = payload.request_id;
    logInfo("fal queue submit", { endpointId: row.id, requestId });
    statusCandidates = falQueueStatusCandidates(row.id, requestId, payload.status_url);
    resultCandidates = falQueueResultCandidates(row.id, requestId, payload.response_url);
  } catch (error) {
    if (error instanceof UnbilledProviderError || error instanceof UncertainBillingError || error instanceof UnknownModelError) throw error;
    if (submitted) throw new UncertainBillingError("The fal queue request left this server and the reply was lost. It was not submitted again.");
    throw new UncertainBillingError("The fal queue request timed out. It was not submitted again.");
  }

  let completed = false;
  let lastStatusError = "";
  let statusIndex = 0;
  try {
  while (now() < deadline) {
    const statusUrl = statusCandidates[Math.min(statusIndex, statusCandidates.length - 1)] || "";
    let statusResponse: Response;
    try {
      statusResponse = await fetchImpl(withLogs(statusUrl), {
        headers: { Authorization: `Key ${args.apiKey}` },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      await sleep(falPollDelayMs());
      continue;
    }
    if (!statusResponse.ok) {
      const body = await statusResponse.text().catch(() => "");
      noteHttp("status", statusResponse.status, body);
      lastStatusError = scrub(body);
      if ((statusResponse.status === 404 || statusResponse.status === 405) && statusIndex < statusCandidates.length - 1) {
        statusIndex += 1;
        continue;
      }
      await sleep(falPollDelayMs());
      continue;
    }
    let status: StatusBody;
    try {
      status = (await statusResponse.json()) as StatusBody;
    } catch {
      noteHttp("status", statusResponse.status, "status body was not JSON");
      if (statusIndex < statusCandidates.length - 1) {
        statusIndex += 1;
        continue;
      }
      await sleep(falPollDelayMs());
      continue;
    }
    const returned = acceptedQueueUrl(status.response_url, requestId);
    if (returned) resultCandidates = falQueueResultCandidates(row.id, requestId, returned);
    if (status.status === "IN_QUEUE" || status.status === "IN_PROGRESS") {
      await sleep(falPollDelayMs(status.status));
      continue;
    }
    if (status.status === "COMPLETED") {
      completed = true;
      const detail = statusDetail(status);
      if (status.error || status.error_type) {
        noteHttp("status", 200, JSON.stringify({ error: status.error, error_type: status.error_type }));
        throw new BilledProviderError(args.estimateUsd, undefined, `fal finished with an error. The call was not retried. ${detail}`);
      }
      break;
    }
    lastStatusError = statusDetail(status) || scrub(JSON.stringify(status).slice(0, 400));
    await sleep(falPollDelayMs(status.status));
  }
  if (!completed) {
    throw new UncertainBillingError(`The fal edit did not finish before the deadline. The queue request was not submitted again.${lastStatusError ? ` ${lastStatusError}` : ""}`);
  }

  type FalResult = {
    images?: { url?: string; width?: number; height?: number }[];
    has_nsfw_concepts?: boolean[];
    error?: string;
    detail?: string;
  };
  let result: FalResult | null = null;
  let resultError = "";
  for (const resultUrl of resultCandidates) {
    let resultResponse: Response;
    try {
      resultResponse = await fetchImpl(resultUrl, {
        headers: { Authorization: `Key ${args.apiKey}` },
        signal: AbortSignal.timeout(Math.max(1, deadline - now())),
      });
    } catch {
      resultError = "fal marked the edit complete and the result could not be read. It was not submitted again.";
      continue;
    }
    if (!resultResponse.ok) {
      const body = await resultResponse.text().catch(() => "");
      noteHttp("result", resultResponse.status, body);
      resultError = `fal marked the edit complete and the result was refused. It was not submitted again.${body ? ` ${scrub(body)}` : ""}`;
      if (resultResponse.status === 404 || resultResponse.status === 405) continue;
      throw new UncertainBillingError(resultError);
    }
    let parsed: FalResult;
    try {
      parsed = (await resultResponse.json()) as FalResult;
    } catch {
      noteHttp("result", resultResponse.status, "result body was not JSON");
      resultError = "fal marked the edit complete and the result could not be read. It was not submitted again.";
      continue;
    }
    if (parsed.error || (typeof parsed.detail === "string" && parsed.detail)) {
      noteHttp("result", 200, JSON.stringify({ error: parsed.error, detail: parsed.detail }));
      throw new BilledProviderError(args.estimateUsd, undefined, `fal finished with an error. The call was not retried. ${scrub(parsed.error || parsed.detail || "")}`);
    }
    if ((parsed.images?.[0]?.url || "").startsWith("https://")) {
      result = parsed;
      break;
    }
    noteHttp("result", 200, JSON.stringify(parsed));
    resultError = "fal finished without an image URL. The call was not retried.";
  }
  if (!result) {
    if (resultError.startsWith("fal finished without")) {
      throw new BilledProviderError(args.estimateUsd, undefined, resultError);
    }
    throw new UncertainBillingError(resultError || "fal marked the edit complete and the result was refused. It was not submitted again.");
  }
  const imageUrl = result.images?.[0]?.url || "";
  const imageResponse = await fetchImpl(imageUrl, { signal: AbortSignal.timeout(Math.max(1, deadline - now())) }).catch(() => {
    throw new UncertainBillingError("The fal image URL could not be downloaded. The edit was not submitted again.");
  });
  if (!imageResponse.ok) {
    throw new UncertainBillingError("The fal image URL was refused. The edit was not submitted again.");
  }
  const bytes = Buffer.from(await imageResponse.arrayBuffer());
  if (await imageLooksBlocked(bytes, result.has_nsfw_concepts)) {
    throw new BilledProviderError(
      args.estimateUsd,
      undefined,
      "The safety checker blocked this image. fal returned a black frame or marked it unsafe. The call was not retried.",
    );
  }
  const image = await sharp(bytes, { failOn: "none" }).rotate().jpeg({ quality: 86, mozjpeg: true }).toBuffer();
  const meta = await sharp(image, { failOn: "none" }).metadata();
  const width = meta.width || result.images?.[0]?.width || 0;
  const height = meta.height || result.images?.[0]?.height || 0;
  return { image, requestId, outputSize: width && height ? `${width}x${height}` : "" };
  } catch (error) {
    if (requestId && (error instanceof UncertainBillingError || error instanceof BilledProviderError)) error.requestId = requestId;
    throw error;
  }
}
