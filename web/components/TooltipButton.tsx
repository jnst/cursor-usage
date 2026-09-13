import {
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
} from "react";

type Props = ComponentPropsWithRef<"button"> & {
  "aria-label": string;
  tooltipSuppressed?: boolean;
};

/** Keep icon help reachable by pointer and keyboard without moving focus. */
export function TooltipButton({ ref, tooltipSuppressed = false, ...props }: Props) {
  const button = useRef<HTMLButtonElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const id = useId();
  const visible = open && !tooltipSuppressed;
  useImperativeHandle(ref, () => button.current!, []);

  const show = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hide = () => {
    clearTimeout(closeTimer.current);
    setOpen(false);
  };
  const hideAfterLeave = () => {
    clearTimeout(closeTimer.current);
    // Allow the pointer to cross the small gap into the tooltip itself.
    closeTimer.current = setTimeout(() => {
      if (!button.current?.matches(":hover, :focus-visible") && !tooltip.current?.matches(":hover"))
        setOpen(false);
    }, 120);
  };
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  useLayoutEffect(() => {
    const target = button.current;
    const popup = tooltip.current;
    if (!target || !popup) return;
    // Popovers escape clipping and stacking contexts. Fixed positioning also
    // supports browsers without the Popover API or CSS anchor positioning.
    const native = typeof popup.showPopover === "function";
    if (!visible) {
      if (native && popup.matches(":popover-open")) popup.hidePopover();
      return;
    }
    if (native && !popup.matches(":popover-open")) popup.showPopover();
    const position = () => {
      const anchor = target.getBoundingClientRect();
      const box = popup.getBoundingClientRect();
      const left = Math.max(
        8,
        Math.min(anchor.left + (anchor.width - box.width) / 2, innerWidth - box.width - 8),
      );
      const top =
        anchor.bottom + 8 + box.height <= innerHeight - 8
          ? anchor.bottom + 8
          : Math.max(8, anchor.top - box.height - 8);
      popup.style.left = `${left}px`;
      popup.style.top = `${top}px`;
    };
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    position();
    window.addEventListener("resize", position);
    document.addEventListener("scroll", position, true);
    document.addEventListener("keydown", dismiss);
    return () => {
      window.removeEventListener("resize", position);
      document.removeEventListener("scroll", position, true);
      document.removeEventListener("keydown", dismiss);
    };
  }, [visible, props["aria-label"]]);

  return (
    <>
      <button
        {...props}
        ref={button}
        aria-describedby={
          [props["aria-describedby"], visible ? id : undefined].filter(Boolean).join(" ") ||
          undefined
        }
        onPointerEnter={(event) => {
          if (event.pointerType !== "touch") show();
          props.onPointerEnter?.(event);
        }}
        onPointerLeave={(event) => {
          hideAfterLeave();
          props.onPointerLeave?.(event);
        }}
        onFocus={(event) => {
          show();
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          hideAfterLeave();
          props.onBlur?.(event);
        }}
        onClick={(event) => {
          hide();
          props.onClick?.(event);
        }}
      />
      <span
        ref={tooltip}
        id={id}
        className="button-tooltip"
        role="tooltip"
        popover="auto"
        data-open={visible}
        onToggle={(event) => {
          if (event.newState === "closed") setOpen(false);
        }}
        onPointerEnter={show}
        onPointerLeave={hideAfterLeave}
      >
        {props["aria-label"]}
      </span>
    </>
  );
}
