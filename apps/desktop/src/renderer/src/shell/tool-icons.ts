import {
  Braces,
  Bug,
  Calculator,
  Calendar,
  Clock,
  Code,
  Database,
  FileCode,
  FileJson,
  FileOutput,
  FileText,
  Folder,
  Globe,
  Hash,
  Link,
  ListChecks,
  Lock,
  type LucideIcon,
  Puzzle,
  Regex,
  Search,
  StickyNote,
  Terminal,
  Wrench,
} from "lucide-react";

// Mapa fijo por nombre en kebab-case: solo se incluyen estos iconos en el bundle.
const toolIcons: Record<string, LucideIcon> = {
  braces: Braces,
  bug: Bug,
  calculator: Calculator,
  calendar: Calendar,
  clock: Clock,
  code: Code,
  database: Database,
  "file-code": FileCode,
  "file-json": FileJson,
  "file-output": FileOutput,
  "file-text": FileText,
  folder: Folder,
  globe: Globe,
  hash: Hash,
  link: Link,
  "list-checks": ListChecks,
  lock: Lock,
  puzzle: Puzzle,
  regex: Regex,
  search: Search,
  "sticky-note": StickyNote,
  terminal: Terminal,
  wrench: Wrench,
};

export function toolIcon(name: unknown): LucideIcon {
  if (typeof name !== "string") return Puzzle;
  return Object.hasOwn(toolIcons, name) ? (toolIcons[name] ?? Puzzle) : Puzzle;
}
