/** Browser digest of the selfie bytes. The server id of the resized file is separate. */
export async function blobDigest(blob: Blob) {
  const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function shotFromBlob(blob: Blob) {
  return { blob, url: URL.createObjectURL(blob), digest: await blobDigest(blob) };
}

export function attachSelfie(body: FormData, shot: { blob: Blob; serverId?: string }, filename: string) {
  if (shot.serverId) body.set("photoId", shot.serverId);
  else body.set("photo", shot.blob, filename);
}

export function readPhotoId(res: Response) {
  const id = res.headers.get("x-photo-id") || "";
  return /^[a-f0-9]{64}$/.test(id) ? id : "";
}
