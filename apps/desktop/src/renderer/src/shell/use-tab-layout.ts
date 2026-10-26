import {
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export function tabInsets(width: number, left: number, right: number, required: number) {
  const symmetric = Math.max(left, right);
  return required <= width - 2 * symmetric
    ? { left: symmetric, right: symmetric }
    : { left, right };
}

export function squeezeActiveTab({
  hasNotice,
  width,
  left,
  minRight,
  required,
}: {
  hasNotice: boolean;
  width: number;
  left: number;
  minRight: number;
  required: number;
}) {
  return hasNotice && width - left - required - 12 < minRight;
}

export function useTabCenter() {
  const headerRef = useRef<HTMLElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({
    width: Infinity,
    left: 0,
    right: 0,
    naturalRight: 0,
    minRight: 0,
  });
  useLayoutEffect(() => {
    const header = headerRef.current;
    const brand = brandRef.current;
    const actions = actionsRef.current;
    if (!header || !brand || !actions || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const rect = header.getBoundingClientRect();
      if (rect.width <= 0) return;
      const gap =
        header.dataset.hasNotice === "true"
          ? 12
          : Number.parseFloat(getComputedStyle(header).columnGap) || 0;
      const overflow = [...actions.querySelectorAll<HTMLElement>("[data-notice-text]")]
        .filter((node) => !node.closest("[data-notice-back]"))
        .reduce((sum, node) => {
          const copy = node.querySelector<HTMLElement>("[data-notice-copy]");
          const natural = copy ? Math.max(copy.scrollWidth, copy.getBoundingClientRect().width) : 0;
          return sum + Math.max(0, natural - node.clientWidth);
        }, 0);
      const number = (value: string) => Number.parseFloat(value) || 0;
      const capsule = actions.querySelector<HTMLElement>(".ld-notice-front [data-notice-capsule]");
      let minRight = 0;
      if (capsule) {
        const style = getComputedStyle(capsule);
        const children = [...capsule.children] as HTMLElement[];
        const capsuleMin =
          40 +
          number(style.paddingLeft) +
          number(style.paddingRight) +
          number(style.columnGap) * Math.max(0, children.length - 1) +
          children
            .filter((child) => !child.matches("[data-notice-text]"))
            .reduce(
              (sum, child) =>
                sum +
                child.getBoundingClientRect().width +
                number(getComputedStyle(child).marginLeft) +
                number(getComputedStyle(child).marginRight),
              0,
            );
        const fixed = [...actions.children].slice(1) as HTMLElement[];
        const notices = actions.firstElementChild;
        // Solo controles fijos y estilos: independiente del ancho actual de la tira.
        minRight =
          number(getComputedStyle(header).paddingRight) +
          capsuleMin +
          fixed.reduce((sum, child) => sum + child.getBoundingClientRect().width, 0) +
          number(getComputedStyle(actions).columnGap) * fixed.length +
          (notices ? number(getComputedStyle(notices).marginRight) : 0);
      }
      setBounds({
        minRight,
        width: rect.width,
        left: brand.getBoundingClientRect().right - rect.left + gap,
        right: rect.right - actions.getBoundingClientRect().left + gap,
        naturalRight: rect.right - actions.getBoundingClientRect().left + gap + overflow,
      });
    };
    const observer = new ResizeObserver(measure);
    for (const element of [header, brand, actions]) observer.observe(element);
    const mutations = new MutationObserver(measure);
    mutations.observe(actions, { childList: true, subtree: true, characterData: true });
    measure();
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, []);
  return { headerRef, brandRef, actionsRef, ...bounds };
}

export function useCompactTabs(
  listRef: RefObject<HTMLDivElement | null>,
  names: string[],
  activeIndex: number,
  available: number,
  windowWidth = Infinity,
) {
  const [space, setSpace] = useState({ available: Infinity, widths: [] as number[] });
  useEffect(() => {
    const container = listRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const labels = [...container.querySelectorAll<HTMLElement>("[data-tab-name]")];
      const widths = names.map((_, index) => labels[index]?.scrollWidth ?? 0);
      setSpace({ available: entry.contentRect.width, widths });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [listRef, names]);
  const padding = 8 + Math.max(0, names.length - 1) * 4;
  const widths = names.map((_, index) => {
    const width = space.widths[index] ?? 0;
    return width > 0 ? Math.min(192, width + 75) : 192;
  });
  // La compactación depende del espacio libre, nunca del ancho que deje el centrado.
  const compact =
    windowWidth < 900 ||
    names.length > 5 ||
    (Number.isFinite(available) ? available : space.available) <
      widths.reduce((sum, width) => sum + width, padding);
  const required = widths.reduce(
    (sum, width, index) => sum + (compact && index !== activeIndex ? 31 : width),
    padding,
  );
  return { compact, required, compactRequired: padding + names.length * 31 };
}

export function useTabLayout(
  listRef: RefObject<HTMLDivElement | null>,
  names: string[],
  activeIndex: number,
  page: string,
  hasNotice: boolean,
  windowInset: number,
) {
  const bounds = useTabCenter();
  const { width, left, right, naturalRight, minRight } = bounds;
  const {
    compact,
    required: namedRequired,
    compactRequired,
  } = useCompactTabs(
    listRef,
    names,
    width < 900 && page !== "tab" ? -1 : activeIndex,
    width - left - (hasNotice ? naturalRight : right),
    width,
  );
  const squeeze = squeezeActiveTab({ hasNotice, width, left, minRight, required: namedRequired });
  const required = squeeze ? compactRequired : namedRequired;
  return {
    ...bounds,
    compact,
    squeeze,
    listStyle: hasNotice ? { maxWidth: required } : tabInsets(width, left, right, required),
    actionsStyle: {
      minWidth: hasNotice ? Math.max(0, minRight - windowInset) : undefined,
      maxWidth:
        hasNotice && Number.isFinite(width)
          ? Math.max(0, width - left - required - 12 - windowInset)
          : "50%",
    },
  };
}

// El foco sigue siendo independiente de la activación.
export function handleTabKey(
  event: KeyboardEvent<HTMLButtonElement>,
  index: number,
  total: number,
  focus: (target: number) => void,
  reorder: (offset: number) => void,
) {
  if (
    event.ctrlKey &&
    event.shiftKey &&
    (event.key === "ArrowLeft" || event.key === "ArrowRight")
  ) {
    event.preventDefault();
    reorder(event.key === "ArrowRight" ? 1 : -1);
    return;
  }
  let target: number;
  if (event.key === "ArrowRight") target = (index + 1) % total;
  else if (event.key === "ArrowLeft") target = (index - 1 + total) % total;
  else if (event.key === "Home") target = 0;
  else if (event.key === "End") target = total - 1;
  else return;
  event.preventDefault();
  focus(target);
}
