import { Candy, Cookie, Croissant, Donut, Milk, Nut, Package, Popcorn } from "lucide-react";
import { knownProductIcon } from "../shared/product-icons.ts";

const icons = new Map([
  ["cookie", Cookie],
  ["croissant", Croissant],
  ["donut", Donut],
  ["popcorn", Popcorn],
  ["nut", Nut],
  ["candy", Candy],
  ["package", Package],
  ["milk", Milk],
]);
export function ProductIcon({
  icon,
  kind,
  size = 26,
}: {
  icon: unknown;
  kind: string;
  size?: number;
}) {
  const name = knownProductIcon(icon),
    Icon = name ? icons.get(name) : undefined;
  const Resolved = Icon ?? (kind === "material" ? Package : Candy);
  return <Resolved size={size} aria-hidden="true" />;
}
