import { LensError } from "@lensdesk/sdk/errors";

export function assertObject(
  params: unknown,
  required: string[],
  optional: string[] = [],
): Record<string, unknown> {
  if (!params || typeof params !== "object" || Array.isArray(params))
    throw new LensError("E_INVALID_PARAMS", "Expected an object");
  const value = params as Record<string, unknown>;
  if (Object.keys(value).some((key) => !required.includes(key) && !optional.includes(key)))
    throw new LensError("E_INVALID_PARAMS", "Unexpected parameter");
  for (const key of required)
    if (!(key in value)) throw new LensError("E_INVALID_PARAMS", "Missing parameter");
  return value;
}
export function string(value: unknown, key: string): string {
  if (typeof value !== "string") throw new LensError("E_INVALID_PARAMS", `${key} must be a string`);
  return value;
}
function title(value: unknown): string {
  // Una sola línea de hasta 200 caracteres, sin espacios al principio ni al final.
  const text = string(value, "title").trim();
  if (text.length > 200 || /[\r\n\u2028\u2029]/.test(text))
    throw new LensError("E_INVALID_PARAMS", "Invalid note title");
  return text;
}
type Validator<T> = (params: unknown) => T;
export const createSchema: Validator<{ body_md: string; title?: string }> = (params) => {
  const values = assertObject(params, ["body_md"], ["title"]);
  return {
    body_md: string(values.body_md, "body_md"),
    ...(values.title === undefined ? {} : { title: title(values.title) }),
  };
};
export const updateSchema: Validator<{ id: string; body_md: string; title?: string }> = (
  params,
) => {
  const values = assertObject(params, ["id", "body_md"], ["title"]);
  return {
    id: string(values.id, "id"),
    body_md: string(values.body_md, "body_md"),
    ...(values.title === undefined ? {} : { title: title(values.title) }),
  };
};
export const renameSchema: Validator<{ id: string; title: string }> = (params) => {
  const values = assertObject(params, ["id", "title"]);
  return { id: string(values.id, "id"), title: title(values.title) };
};

export function parse<T>(validate: Validator<T>, params: unknown): T {
  return validate(params);
}
