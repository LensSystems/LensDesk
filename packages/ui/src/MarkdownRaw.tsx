import type { SVGProps } from "react";
// Icono decorativo: el nombre accesible lo lleva el botón que lo contiene.
export function MarkdownRaw(props: SVGProps<SVGSVGElement>) {
  return (
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
      {...props}
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="M6 15V9l3 3 3-3v6M17 9v6M14.5 12.5 17 15l2.5-2.5" />
    </svg>
  );
}
