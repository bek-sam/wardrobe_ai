"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Size } from "@/lib/visualization";

/**
 * Tracks the image's intrinsic size and its container's CSS-pixel size so
 * hotspots can be projected exactly onto the painted area. Everything stays in
 * CSS pixels — device-pixel-ratio never enters the calculation, which is what
 * keeps the overlay aligned on a retina display.
 */
export function useImageGeometry() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [natural, setNatural] = useState<Size | null>(null);
  const [container, setContainer] = useState<Size | null>(null);

  const onImageLoad = useCallback((event: { currentTarget: HTMLImageElement }) => {
    const image = event.currentTarget;
    setNatural({ width: image.naturalWidth, height: image.naturalHeight });
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) setContainer({ width: box.width, height: box.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { containerRef, natural, container, onImageLoad };
}
