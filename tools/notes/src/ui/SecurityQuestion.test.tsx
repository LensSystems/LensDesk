import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18next from "i18next";
import { I18nextProvider } from "react-i18next";
import { expect, it, vi } from "vitest";
import en from "../../locales/en.json";
import es from "../../locales/es.json";
import { SecurityQuestion } from "./SecurityQuestion.tsx";

Element.prototype.scrollIntoView = vi.fn();
it.each(["es", "en"])(
  "preguntas usan el selector compartido y conservan selección/exclusión en %s",
  async (lng) => {
    const i18n = i18next.createInstance();
    await i18n.init({ lng, resources: { es: { translation: es }, en: { translation: en } } });
    const onQuestion = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <SecurityQuestion
          index={0}
          question="city"
          excluded="pet"
          answer=""
          onQuestion={onQuestion}
          onAnswer={vi.fn()}
        />
      </I18nextProvider>,
    );
    const trigger = screen.getByRole("combobox", { name: i18n.t("vault.question", { number: 1 }) });
    expect(trigger.querySelector(".ld-select-chevron")).toHaveAttribute("aria-hidden", "true");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const city = await screen.findByRole("option", { name: i18n.t("vault.questions.city") });
    await waitFor(() => expect(city).toHaveFocus());
    expect(screen.queryByRole("option", { name: i18n.t("vault.questions.pet") })).toBeNull();
    fireEvent.keyDown(city, { key: "ArrowDown" });
    const school = screen.getByRole("option", { name: i18n.t("vault.questions.school") });
    await waitFor(() => expect(school).toHaveFocus());
    fireEvent.keyDown(school, { key: "Enter" });
    await waitFor(() => expect(onQuestion).toHaveBeenCalledWith("school"));
  },
);
