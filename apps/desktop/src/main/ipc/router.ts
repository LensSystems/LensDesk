import { LensError, type LensErrorCode, type Result } from "@lensdesk/sdk/errors";
import type { z } from "zod";

type ChannelSchema = { request: z.ZodType; response: z.ZodType };
type SchemaMap = Record<string, ChannelSchema>;
type HandlerMap<S extends SchemaMap> = {
  [C in keyof S]: (payload: z.infer<S[C]["request"]>) => unknown;
};

export function createRouter<S extends SchemaMap>(options: {
  schemas: S;
  handlers: HandlerMap<S>;
  isShellSender: (sender: unknown) => boolean;
}): (sender: unknown, channel: string, payload: unknown) => Promise<Result<unknown>> {
  return async (sender, channel, payload) => {
    if (!options.isShellSender(sender))
      return failure("E_PERMISSION_DENIED", "Emisor no autorizado");
    if (!Object.hasOwn(options.schemas, channel))
      return failure("E_METHOD_NOT_FOUND", "Canal desconocido");

    const schema = options.schemas[channel];
    if (!schema) return failure("E_METHOD_NOT_FOUND", "Canal desconocido");
    const request = schema.request.safeParse(payload);
    if (!request.success) return failure("E_INVALID_PARAMS", request.error.message);

    try {
      const handler = options.handlers[channel as keyof S] as (value: unknown) => unknown;
      const data = await handler(request.data);
      const response = schema.response.safeParse(data);
      if (!response.success) return failure("E_INTERNAL", "Respuesta IPC inválida");
      return { ok: true, data: response.data };
    } catch (error) {
      if (error instanceof LensError) return failure(error.code, error.message);
      return failure("E_INTERNAL", "Error interno");
    }
  };
}

function failure(code: LensErrorCode, message: string): Result<never> {
  return { ok: false, error: { code, message } };
}
