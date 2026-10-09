import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from 0 to `target` with an ease-out curve.
 * Respects prefers-reduced-motion by snapping straight to the target.
 */
export default function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const isNumber = typeof target === "number" && !Number.isNaN(target);
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches;

    const settle = () => setValue(isNumber ? target : (target ?? 0));

    if (!isNumber || reduced) {
      frameRef.current = requestAnimationFrame(settle);
      return () => cancelAnimationFrame(frameRef.current);
    }

    let start = null;
    const step = (ts) => {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return value;
}
