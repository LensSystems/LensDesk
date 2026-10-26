import { describe, expect, it } from "vitest";
import { emptyCredential, formatCredential, parseCredential } from "./credential-block.ts";

describe("formato de credenciales", () => {
  it("conserva campos básicos, simples y secretos en la ida y vuelta", () => {
    const value = {
      user: "ada@example.test",
      password: "Una clave!",
      note: "Acceso de trabajo",
      fields: [
        { title: "Servidor", value: "localhost", secret: false },
        { title: "PIN", value: "123456", secret: true },
      ],
    };
    const source = formatCredential(value);
    expect(source).toBe(
      "```credential\nuser: ada@example.test\npassword: Una clave!\nnote: Acceso de trabajo\nfield: Servidor | localhost\nsecret: PIN | 123456\n```",
    );
    expect(parseCredential(source)).toEqual(value);
    expect(parseCredential(formatCredential(emptyCredential()))).toEqual(emptyCredential());
  });

  it("escapa barras, separadores, saltos y vallas sin cambiar los valores", () => {
    const text = " | uno\\dos\nsegunda\r\n```credential\\n\\x60 ";
    const value = {
      user: text,
      password: text,
      note: text,
      fields: [
        { title: "Código | alternativo\\", value: text, secret: false },
        { title: "Secreto\nmultilínea", value: text, secret: true },
      ],
    };
    const source = formatCredential(value);
    expect(source.split("\n")).toHaveLength(7);
    expect(source).toContain("\\| uno\\\\dos\\nsegunda\\r\\n\\x60\\x60\\x60credential");
    expect(parseCredential(source)).toEqual(value);
  });

  it("analiza claves fijas y separadores escapados en ambos tipos de campo", () => {
    expect(
      parseCredential(
        "user: Ada\npassword: clave\nnote: línea\\notra\nfield: Sitio\\|local | a\\|b\nsecret: PIN | 12\\n34\nignorado: x",
      ),
    ).toEqual({
      user: "Ada",
      password: "clave",
      note: "línea\notra",
      fields: [
        { title: "Sitio|local", value: "a|b", secret: false },
        { title: "PIN", value: "12\n34", secret: true },
      ],
    });
  });
});
