import { useEffect } from "react";

/**
 * Spatial navigation for TV remote D-pad.
 * Arrow keys move focus to the nearest focusable element in that direction.
 * Enter/OK clicks the focused element. Only active when enabled (TV mode).
 */
export function useSpatialNavigation(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const FOCUSABLE_SELECTOR = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "video[controls]",
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]:not([disabled])',
    ].join(",");

    const isVisible = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      const style = window.getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") return false;
      return true;
    };

    const findBestCandidate = (
      current: HTMLElement,
      direction: "up" | "down" | "left" | "right"
    ): HTMLElement | null => {
      const all = Array.from(
        document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el !== current && isVisible(el));

      const cur = current.getBoundingClientRect();
      const cx = cur.left + cur.width / 2;
      const cy = cur.top + cur.height / 2;

      let best: HTMLElement | null = null;
      let bestScore = Infinity;

      for (const el of all) {
        const r = el.getBoundingClientRect();
        const ex = r.left + r.width / 2;
        const ey = r.top + r.height / 2;
        const dx = ex - cx;
        const dy = ey - cy;

        let inDirection = false;
        let primary = 0;
        let secondary = 0;

        switch (direction) {
          case "right":
            inDirection = dx > 8;
            primary = dx;
            secondary = Math.abs(dy);
            break;
          case "left":
            inDirection = dx < -8;
            primary = -dx;
            secondary = Math.abs(dy);
            break;
          case "down":
            inDirection = dy > 8;
            primary = dy;
            secondary = Math.abs(dx);
            break;
          case "up":
            inDirection = dy < -8;
            primary = -dy;
            secondary = Math.abs(dx);
            break;
        }

        if (!inDirection) continue;
        // Weight perpendicular distance heavier so we stay on the same row/col
        const score = primary + secondary * 2;
        if (score < bestScore) {
          bestScore = score;
          best = el;
        }
      }
      return best;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      let direction: "up" | "down" | "left" | "right" | null = null;
      switch (e.key) {
        case "ArrowUp":
          direction = "up";
          break;
        case "ArrowDown":
          direction = "down";
          break;
        case "ArrowLeft":
          direction = "left";
          break;
        case "ArrowRight":
          direction = "right";
          break;
        case "Enter":
        case " ":
          // Let native click happen on focused element
          return;
      }

      if (!direction) return;

      const active = (document.activeElement as HTMLElement) || document.body;
      // If nothing focused, focus first focusable
      if (!active || active === document.body) {
        const first = document.querySelector<HTMLElement>(
          'button, a, [tabindex]:not([tabindex="-1"])'
        );
        if (first) {
          e.preventDefault();
          first.focus();
        }
        return;
      }

      const next = findBestCandidate(active, direction);
      if (next) {
        e.preventDefault();
        next.focus();
        next.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
