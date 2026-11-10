import { createHash } from "node:crypto";
import { MAX_BACKUP_BYTES } from "../shared/backup-contracts.ts";
import { DomainFault } from "./domain.ts";
export const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export function encode(value: unknown): Uint8Array {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  if (bytes.length > MAX_BACKUP_BYTES) throw new DomainFault("E_BACKUP_LIMIT");
  return bytes;
}
// Scan keys before JSON.parse, which otherwise silently discards duplicate properties.
export function decode(bytes: Uint8Array): unknown {
  if (bytes.length > MAX_BACKUP_BYTES) throw new DomainFault("E_BACKUP_LIMIT");
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    let i = 0;
    const ws = () => {
      while (/\s/.test(text[i] ?? "") && i < text.length) i++;
    };
    const str = () => {
      const start = i++;
      while (i < text.length) {
        const c = text[i++];
        if (c === '"') return JSON.parse(text.slice(start, i)) as string;
        if (c === "\\") i++;
      }
      throw Error("string");
    };
    const value = (depth: number, key?: string): void => {
      if (depth > 50) throw Error("depth");
      ws();
      const c = text[i];
      if (c === "{") {
        i++;
        ws();
        const keys = new Set<string>();
        if (text[i] === "}") {
          i++;
          return;
        }
        while (i < text.length) {
          ws();
          if (text[i] !== '"') throw Error("key");
          const k = str();
          if (keys.has(k) || ["__proto__", "constructor", "prototype"].includes(k))
            throw Error("key");
          keys.add(k);
          ws();
          if (text[i++] !== ":") throw Error("colon");
          value(depth + 1, k);
          ws();
          const end = text[i++];
          if (end === "}") return;
          if (end !== ",") throw Error("object");
        }
        throw Error("object");
      }
      if (c === "[") {
        i++;
        ws();
        if (text[i] === "]") {
          i++;
          return;
        }
        while (i < text.length) {
          value(depth + 1);
          ws();
          const end = text[i++];
          if (end === "]") return;
          if (end !== ",") throw Error("array");
        }
        throw Error("array");
      }
      if (c === '"') {
        str();
        return;
      }
      const m = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(
        text.slice(i),
      );
      if (!m) throw Error("value");
      const integerFields = new Set([
        "id",
        "amount",
        "cost",
        "qty",
        "price",
        "stock",
        "value",
        "minStock",
        "lastValue",
        "lastQty",
        "grams",
        "total",
        "received",
        "change",
        "refund",
        "initial",
        "ins",
        "outs",
        "expected",
        "counted",
        "difference",
        "term",
        "limit",
        "creditLimit",
        "schema",
        "revision",
        "sequence",
        "folio",
        "sourceRevision",
        "modelVersion",
        "version",
      ]);
      if (/^-?\d/.test(m[0]) && !Number.isFinite(Number(m[0]))) throw Error("number");
      if (
        /^-?\d/.test(m[0]) &&
        key !== "lastCost" &&
        (integerFields.has(key ?? "") || Number.isInteger(Number(m[0])))
      ) {
        const token = m[0];
        if (token.length > 1000) throw Error("number");
        const [mantissa = "", exponent = "0"] = token.toLowerCase().split("e"),
          [whole = "", decimal = ""] = mantissa.split(".");
        const power = Number(exponent) - decimal.length;
        if (Math.abs(power) > 400) throw Error("number");
        let n = BigInt(whole + decimal);
        const d = power < 0 ? 10n ** BigInt(-power) : 1n;
        if (power > 0) n *= 10n ** BigInt(power);
        if (n % d !== 0n || n / d > 9007199254740991n || n / d < -9007199254740991n)
          throw Error("number");
      }
      i += m[0].length;
    };
    value(0);
    ws();
    if (i !== text.length) throw Error("tail");
    return JSON.parse(text);
  } catch {
    throw new DomainFault("E_BACKUP_FORMAT");
  }
}
