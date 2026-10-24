import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { LensError } from "@lensdesk/sdk/errors";

export type ScryptParams = { N: number; r: number; p: number; length: number };
type Ciphertext = { nonce: string; tag: string; data: string };
type Wrap = { salt: string; params: ScryptParams; secret: Ciphertext };
export type VaultRecord = { password: Wrap; recovery: Wrap; questions: [string, string] };
// N=2^15, r=8, p=1, 32 bytes: unos 32 MiB y coste razonable en escritorio.
// Los parámetros se persisten por envoltura; las pruebas inyectan un coste menor.
const defaults: ScryptParams = { N: 32768, r: 8, p: 1, length: 32 };
// Los parámetros guardados se acotan: una base dañada no puede pedir memoria sin límite.
export function checkParams(cost: ScryptParams): void {
  const valid =
    Number.isInteger(cost.N) &&
    cost.N >= 2 &&
    cost.N <= 2 ** 20 &&
    (cost.N & (cost.N - 1)) === 0 &&
    Number.isInteger(cost.r) &&
    cost.r >= 1 &&
    cost.r <= 32 &&
    Number.isInteger(cost.p) &&
    cost.p >= 1 &&
    cost.p <= 16 &&
    cost.length === 32;
  if (!valid) throw new LensError("E_INVALID_PARAMS", "Invalid key derivation parameters");
}
export function normalizeAnswer(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}
function seal(key: Buffer, text: Buffer, aad: string): Ciphertext {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(aad));
  return {
    nonce: nonce.toString("base64"),
    data: Buffer.concat([cipher.update(text), cipher.final()]).toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}
// La autenticación y comparación del tag las realiza GCM en OpenSSL; no hay
// hashes de contraseña ni respuestas que comparar manualmente.
function open(key: Buffer, value: Ciphertext, aad: string): Buffer {
  const cipher = createDecipheriv("aes-256-gcm", key, Buffer.from(value.nonce, "base64"));
  cipher.setAAD(Buffer.from(aad));
  cipher.setAuthTag(Buffer.from(value.tag, "base64"));
  return Buffer.concat([cipher.update(Buffer.from(value.data, "base64")), cipher.final()]);
}
export function createVault(options: { now?: () => number; scrypt?: ScryptParams } = {}) {
  const now = options.now ?? Date.now;
  const params = options.scrypt ?? defaults;
  let key: Buffer | undefined;
  let lastUse = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;
  let retryAt = 0;
  function lock() {
    key?.fill(0);
    key = undefined;
    clearTimeout(timer);
  }
  function touch() {
    lastUse = now();
    clearTimeout(timer);
    timer = setTimeout(lock, 600_000);
    timer.unref();
  }
  function current() {
    if (key && now() - lastUse >= 600_000) lock();
    if (!key) throw new LensError("E_PERMISSION_DENIED", "Vault locked");
    touch();
    return key;
  }
  function derive(text: string, salt: string, cost: ScryptParams) {
    checkParams(cost);
    return scryptSync(text, Buffer.from(salt, "base64"), cost.length, {
      N: cost.N,
      r: cost.r,
      p: cost.p,
      maxmem: Math.max(64 * 1024 * 1024, 256 * cost.N * cost.r),
    });
  }
  function wrap(data: Buffer, text: string, purpose: string): Wrap {
    const salt = randomBytes(16).toString("base64");
    const derived = derive(text, salt, params);
    try {
      return { salt, params: { ...params }, secret: seal(derived, data, purpose) };
    } finally {
      derived.fill(0);
    }
  }
  function recover(
    record: VaultRecord | undefined,
    text: string,
    purpose: "password" | "recovery",
  ) {
    if (now() < retryAt)
      throw new LensError(
        "E_PERMISSION_DENIED",
        `Too many attempts. Wait ${Math.ceil((retryAt - now()) / 1000)} seconds`,
      );
    try {
      if (!record) throw new Error("Unavailable");
      const value = record[purpose];
      const derived = derive(text, value.salt, value.params);
      try {
        return open(derived, value.secret, purpose);
      } finally {
        derived.fill(0);
      }
    } catch {
      failures++;
      if (failures >= 5)
        retryAt = now() + Math.min(300_000, 30_000 * 2 ** Math.min(failures - 5, 9));
      throw new LensError(
        "E_PERMISSION_DENIED",
        failures >= 5
          ? `Too many attempts. Wait ${Math.ceil((retryAt - now()) / 1000)} seconds`
          : `Invalid credentials. ${5 - failures} attempts left`,
      );
    }
  }
  const answers = (values: [string, string]) => JSON.stringify(values.map(normalizeAnswer));
  function activate(value: Buffer) {
    lock();
    key = value;
    failures = 0;
    retryAt = 0;
    touch();
  }
  return {
    lock,
    unlocked() {
      if (key && now() - lastUse >= 600_000) lock();
      return Boolean(key);
    },
    // `persist` guarda el registro; la clave solo se activa si se guardó, para no cifrar notas
    // con una clave que no podría recuperarse tras cerrar.
    setup(
      password: string,
      questions: [string, string],
      responses: [string, string],
      persist: (record: VaultRecord) => void,
    ): void {
      const data = randomBytes(32);
      try {
        persist({
          password: wrap(data, password, "password"),
          recovery: wrap(data, answers(responses), "recovery"),
          questions,
        });
        activate(Buffer.from(data));
      } finally {
        data.fill(0);
      }
    },
    unlock(record: VaultRecord | undefined, password: string) {
      activate(recover(record, password, "password"));
    },
    reset(
      record: VaultRecord | undefined,
      responses: [string, string],
      password: string,
      persist: (record: VaultRecord) => void,
    ): void {
      const data = recover(record, answers(responses), "recovery");
      try {
        persist({
          ...(record as VaultRecord),
          password: wrap(data, password, "password"),
          recovery: wrap(data, answers(responses), "recovery"),
        });
        activate(Buffer.from(data));
      } finally {
        data.fill(0);
      }
    },
    encrypt(text: string, id: string) {
      return JSON.stringify(seal(current(), Buffer.from(text), id));
    },
    decrypt(text: string, id: string) {
      const data = current();
      try {
        return open(data, JSON.parse(text) as Ciphertext, id).toString("utf8");
      } catch {
        throw new LensError("E_PERMISSION_DENIED", "Cannot decrypt note");
      }
    },
  };
}
export type Vault = ReturnType<typeof createVault>;
