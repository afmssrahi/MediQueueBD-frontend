"use client";

import * as React from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/provider";
import type { Coordinates } from "@/types";

/**
 * The static map placeholder.
 *
 * The prototype deliberately has no map dependency. The panel shows the
 * facility's coordinates on a simple grid and says plainly that the
 * interactive map arrives with the map service.
 */

interface MapPlaceholderProps {
  coordinates: Coordinates;
  label?: string;
  /** Optional nearby points, drawn as secondary markers. */
  markers?: { coordinates: Coordinates; label: string }[];
  className?: string;
  height?: number;
}

/**
 * Convert coordinates into a percentage position on the preview grid.
 *
 * The bounds cover Bangladesh, so a facility in Bogura and one in Chattogram
 * both land inside the frame.
 */
function toPercent(coordinates: Coordinates): { x: number; y: number } {
  const minLatitude = 20.5;
  const maxLatitude = 26.5;
  const minLongitude = 88;
  const maxLongitude = 92.8;

  const x = ((coordinates.longitude - minLongitude) / (maxLongitude - minLongitude)) * 100;
  const y = 100 - ((coordinates.latitude - minLatitude) / (maxLatitude - minLatitude)) * 100;

  return {
    x: Math.min(98, Math.max(2, x)),
    y: Math.min(98, Math.max(2, y)),
  };
}

export function MapPlaceholder({
  coordinates,
  label,
  markers = [],
  className,
  height = 240,
}: MapPlaceholderProps) {
  const { t } = useTranslation();
  const position = toPercent(coordinates);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-muted/40",
        className,
      )}
      style={{ height }}
      role="img"
      aria-label={label ?? t("maps.mapPlaceholder")}
    >
      {/* A faint grid so the placeholder reads as a map surface. */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden="true"
      />

      {/* The nearby facilities sit behind the selected one. */}
      {markers.map((marker) => {
        const markerPosition = toPercent(marker.coordinates);
        return (
          <span
            key={marker.label}
            className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/50"
            style={{ left: `${markerPosition.x}%`, top: `${markerPosition.y}%` }}
            title={marker.label}
            aria-hidden="true"
          />
        );
      })}

      {/* The selected facility. */}
      <span
        className="absolute flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md"
        style={{ left: `${position.x}%`, top: `${position.y}%` }}
      >
        <MapPin className="size-4" />
      </span>

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-background/85 p-3 backdrop-blur">
        <p className="text-xs font-medium">
          {label ?? t("maps.mapPlaceholder")}
        </p>
        <p className="text-[0.7rem] text-muted-foreground">
          {t("maps.mapPlaceholderHint")}
        </p>
      </div>
    </div>
  );
}
