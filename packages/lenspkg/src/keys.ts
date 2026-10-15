import type { KeyObject } from "node:crypto";
import { generateKeyPairSync, sign, verify } from "node:crypto";
import { canonicalPayload, type PackageFile } from "./canonical.ts";

export function generateKeyPair() {
  const pair = generateKeyPairSync("ed25519");
  return {
    publicKeyPem: pair.publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKeyPem: pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
}
export function signFiles(
  keyId: string,
  files: PackageFile[],
  privateKey: string | Buffer | KeyObject,
): string {
  return sign(null, canonicalPayload(keyId, files), privateKey).toString("base64");
}
export function verifySignature(
  keyId: string,
  files: PackageFile[],
  signature: string,
  publicKey: string | Buffer | KeyObject,
): boolean {
  try {
    return verify(
      null,
      canonicalPayload(keyId, files),
      publicKey,
      Buffer.from(signature, "base64"),
    );
  } catch {
    return false;
  }
}
