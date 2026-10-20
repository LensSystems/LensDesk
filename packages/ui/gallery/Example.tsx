import type { ReactNode } from "react";

export function Example({ names, children }: { names: string[]; children: ReactNode }) {
  return (
    <section className="gallery-example">
      <h3>{names.join(" · ")}</h3>
      {names.map((name) => (
        <span key={name} data-component={name} />
      ))}
      {children}
    </section>
  );
}
