import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

let activeLocks = 0;
let savedScrollY = 0;
let savedBodyStyles:
  | {
      position: string;
      top: string;
      left: string;
      right: string;
      width: string;
      overflow: string;
    }
  | null = null;

function lockBodyScroll() {
  const { body } = document;

  if (activeLocks === 0) {
    savedScrollY = window.scrollY;
    savedBodyStyles = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = "fixed";
    body.style.top = `-${savedScrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
  }

  activeLocks += 1;

  return () => {
    activeLocks = Math.max(0, activeLocks - 1);
    if (activeLocks > 0 || !savedBodyStyles) return;

    body.style.position = savedBodyStyles.position;
    body.style.top = savedBodyStyles.top;
    body.style.left = savedBodyStyles.left;
    body.style.right = savedBodyStyles.right;
    body.style.width = savedBodyStyles.width;
    body.style.overflow = savedBodyStyles.overflow;
    window.scrollTo(0, savedScrollY);
    savedBodyStyles = null;
  };
}

export function ModalPortal({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    return lockBodyScroll();
  }, []);

  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
