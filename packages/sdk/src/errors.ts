export const LENS_ERROR_CODES = [
  "E_SIGNATURE_INVALID",
  "E_HASH_MISMATCH",
  "E_UNSIGNED",
  "E_MANIFEST_INVALID",
  "E_API_VERSION_UNSUPPORTED",
  "E_HOST_TOO_OLD",
  "E_ZIP_UNSAFE_PATH",
  "E_TOO_LARGE",
  "E_TOOL_NOT_FOUND",
  "E_DOWNGRADE_CONFIRM",
  "E_PERMISSION_DENIED",
  "E_PATH_NOT_GRANTED",
  "E_INVALID_PARAMS",
  "E_METHOD_NOT_FOUND",
  "E_BACKEND_UNAVAILABLE",
  "E_BACKEND_CRASHED",
  "E_CANCELLED",
  "E_INTERNAL",
  "E_NOT_FOUND",
] as const;

export type LensErrorCode = (typeof LENS_ERROR_CODES)[number];

export class LensError extends Error {
  readonly code: LensErrorCode;

  constructor(code: LensErrorCode, message: string) {
    super(message);
    this.name = "LensError";
    this.code = code;
  }
}

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: LensErrorCode; message: string } };
