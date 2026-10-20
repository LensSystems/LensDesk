import { useShellStore } from "../state/store.ts";
import { brandColors } from "./brand-colors.ts";

export function AppLogo() {
  const accent = useShellStore((state) => state.context.accent);
  const color = accent === "green" ? brandColors.green : brandColors.blue;
  return (
    <svg width="60" height="60" viewBox="0 0 100 100" aria-hidden="true" className="shrink-0">
      <rect width="100" height="100" rx="22" fill={color} />
      <rect x="21" y="27" width="52" height="52" rx="9" fill={brandColors.white} />
      <circle cx="47" cy="27" r="10" fill={brandColors.white} />
      <circle cx="73" cy="53" r="10" fill={brandColors.white} />
      <text
        x="47"
        y="63"
        textAnchor="middle"
        fontFamily="'Manrope Variable', Manrope, sans-serif"
        fontWeight="800"
        fontSize="28"
        letterSpacing="-1.5"
        fill={brandColors.slate}
      >
        L<tspan fill={color}>D</tspan>
      </text>
    </svg>
  );
}
