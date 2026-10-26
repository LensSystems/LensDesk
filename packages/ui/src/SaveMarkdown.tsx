import type { SVGProps } from "react";
// Icono decorativo: el nombre accesible lo lleva el botón que lo contiene.
export function SaveMarkdown({
  chip = false,
  className,
  ...props
}: SVGProps<SVGSVGElement> & { chip?: boolean }) {
  const icon = (
    <svg
      aria-hidden="true"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={chip ? undefined : className}
      {...props}
    >
      <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
      <path d="M7 3v4a1 1 0 0 0 1 1h7" />
      {!chip && (
        <>
          <rect x="9" y="14" width="15" height="10" rx="3" fill="currentColor" stroke="none" />
          <text
            x="16.5"
            y="21.6"
            textAnchor="middle"
            fill="var(--ld-surface)"
            stroke="none"
            fontSize="7.5"
            fontWeight="800"
          >
            MD
          </text>
        </>
      )}
    </svg>
  );
  if (!chip) return icon;
  // Variante con la insignia «MD» como chip sobre la esquina inferior derecha del icono.
  return (
    <span aria-hidden="true" className={`relative size-4 shrink-0 ${className ?? ""}`}>
      {icon}
      <span className="absolute top-3 left-[5.8px] h-2.5 rounded-[4px] bg-accent px-[3px] text-[8px] leading-[10px] font-extrabold text-accent-fg shadow-[0_0_0_2px_var(--ld-surface)]">
        MD
      </span>
    </span>
  );
}
