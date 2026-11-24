import { useEffect, useRef } from "react";
import "pannellum/build/pannellum.css";
import type { PannellumViewer } from "@/pannellum";

type Props = {
  src: string;
  label: string;
};

export function PanoViewer({ src, label }: Props) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = host.current;
    if (!node) return;

    let viewer: PannellumViewer | undefined;
    let cancelled = false;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    void import("pannellum/build/pannellum.js").then(() => {
      if (cancelled || !host.current || !window.pannellum) return;
      viewer = window.pannellum.viewer(host.current, {
        type: "equirectangular",
        panorama: src,
        crossOrigin: "anonymous",
        autoLoad: true,
        compass: true,
        showZoomCtrl: true,
        showFullscreenCtrl: true,
        hfov: 100,
        minHfov: 40,
        maxHfov: 120,
        pitch: -6,
        yaw: 18,
        autoRotate: reduceMotion ? 0 : -1.2,
        autoRotateInactivityDelay: 5000,
        mouseZoom: true,
      });
    });

    return () => {
      cancelled = true;
      viewer?.destroy();
    };
  }, [src]);

  return <div ref={host} className="sp-pano" role="application" aria-label={label} />;
}
