import { type ReactNode, useRef, useState } from "react";
import { NoticeText } from "./NoticeText.tsx";

export function NoticeCapsule({
  children,
  text,
  icon,
  status = false,
}: {
  children: ReactNode;
  text: ReactNode;
  icon?: ReactNode;
  status?: boolean;
}) {
  const [paused, setPaused] = useState(false);
  const pointer = useRef(false);
  const focus = useRef(false);
  return (
    <div
      role={status ? "status" : undefined}
      onPointerEnter={() => {
        pointer.current = true;
        setPaused(true);
      }}
      onPointerLeave={() => {
        pointer.current = false;
        setPaused(focus.current);
      }}
      onFocusCapture={() => {
        focus.current = true;
        setPaused(true);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          focus.current = false;
          setPaused(pointer.current);
        }
      }}
      data-notice-capsule
      className="flex h-8 min-w-0 [&>[data-notice-text]]:min-w-10 [&>:not([data-notice-text])]:shrink-0 items-center gap-1 rounded-full bg-accent-soft pl-3 pr-1 text-xs text-accent-soft-fg"
    >
      {icon}
      <NoticeText paused={paused}>{text}</NoticeText>
      {children}
    </div>
  );
}
