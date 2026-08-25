/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import { translations, formatMsg } from "@/lib/i18n";
import type { Lang, Messages } from "@/lib/i18n";
import { Flag } from "@/components/Flag";
import { worldRegionMapData } from "@/lib/worldRegionMapData";
import {
  buildRegionStatusSummary,
  type RegionStatus,
  type RegionStatusMapNode,
  type RegionStatusRegion,
} from "@/lib/regionStatusMap";
import { zenType } from "@/lib/typography";
import { zenPopover, zenText } from "@/lib/zenSemantics";
import { zenMotion } from "@/lib/zenMotion";
import { RegionServerTable } from "@/components/RegionServerTable";
import "./RegionStatusWorldMap.css";

export type RegionStatusWorldMapNode = RegionStatusMapNode;

interface RegionStatusWorldMapProps {
  nodes: RegionStatusWorldMapNode[];
  theme: "light" | "dark";
  lang: Lang;
  /** Inline section on mobile; modal body on desktop popup. */
  presentation?: "inline" | "modal";
  /** Hide section title row (e.g. mobile collapsible inside header stats). */
  hideHeader?: boolean;
  /** Tighter layout when nested inside another panel. */
  embedded?: boolean;
}

type HoveredRegion = {
  regionKey: string;
  x: number;
  y: number;
  horizontal: "left" | "right";
  vertical: "above" | "below";
};

const MAP_W = worldRegionMapData.w;
const MAP_H = worldRegionMapData.h;
const DESKTOP_MQ = "(min-width: 768px)";
const MOBILE_MAP_WIDTH = 720;
const HOVER_CARD_GAP = 12;
const HOVER_CARD_MAX_WIDTH = 320;
const HOVER_CARD_FALLBACK_HEIGHT = 124;
const HOVER_CARD_EDGE_PADDING = 8;

function parseViewBox(value: string): [number, number, number, number] {
  const [x, y, w, h] = value.split(/\s+/).map(Number);
  return [x ?? 0, y ?? 0, w ?? MAP_W, h ?? MAP_H];
}

const STATUS_BADGE_CLASS: Record<RegionStatus, string> = {
  online: "border-zen-success/40 bg-zen-success/10 text-zen-success",
  partial: "border-zen-warning/40 bg-zen-warning/10 text-zen-warning",
  offline: "border-zen-danger/40 bg-zen-danger/10 text-zen-danger",
};

function statusLabel(t: Messages, status: RegionStatus): string {
  if (status === "online") return t.mapStatusOnline;
  if (status === "offline") return t.mapStatusOffline;
  return t.mapStatusPartial;
}

function RegionStatusPanel({
  region,
  lang,
  floating = false,
  className = "",
}: {
  region: RegionStatusRegion;
  lang: Lang;
  floating?: boolean;
  className?: string;
}) {
  const t = translations[lang];
  const shell = floating
    ? `px-2.5 py-2 font-mono normal-case ${zenType.caption} tracking-normal ${className}`
    : `rounded-sm border px-2.5 py-2 font-mono normal-case ${zenType.caption} tracking-normal ${zenPopover} ${className}`;

  return (
    <div className={shell}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Flag flag={region.emoji} className="h-5 w-5" />
          <div className="min-w-0">
            <div className="text-[0.6875rem] font-bold uppercase tracking-wider text-zen-fg-faint">
              {region.flagCode}
            </div>
            <div className="truncate font-bold text-zen-fg-strong">
              {region.label}
            </div>
          </div>
        </div>
        <span
          className={`shrink-0 whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-[0.6875rem] font-bold ${STATUS_BADGE_CLASS[region.status]}`}
        >
          {statusLabel(t, region.status)}
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-zen-fg-muted">
        <span className="font-bold text-zen-fg-strong">
          {region.total} {t.mapNodes}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-zen-success" aria-hidden />
          {region.online} {t.mapStatusOnline}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-zen-danger" aria-hidden />
          {region.offline} {t.mapStatusOffline}
        </span>
      </div>

      <ul className="mt-1.5 max-h-44 space-y-0.5 overflow-y-auto border-t border-zen-line pt-1.5">
        {region.nodes.map((node) => (
          <li
            key={node.id}
            className={`flex min-w-0 items-center gap-1.5 leading-snug ${
              node.online ? "" : "opacity-60"
            }`}
          >
            <span
              className={`shrink-0 ${
                node.online ? "text-zen-success" : "text-zen-fg-subtle"
              }`}
              aria-hidden
            >
              {node.online ? "●" : "○"}
            </span>
            <span className="min-w-0 flex-1 truncate" title={node.name}>
              {node.name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const RegionStatusWorldMap = React.memo(function RegionStatusWorldMap({
  nodes,
  theme,
  lang,
  presentation = "inline",
  hideHeader = false,
  embedded = false,
}: RegionStatusWorldMapProps) {
  const isModal = presentation === "modal";
  const scrollRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const hoverCardRef = useRef<HTMLDivElement>(null);
  const hoverFrameRef = useRef<number | null>(null);
  const pendingHoverPositionRef = useRef<
    Omit<HoveredRegion, "regionKey"> | null
  >(null);
  const [hovered, setHovered] = useState<HoveredRegion | null>(null);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(DESKTOP_MQ).matches,
  );
  const summary = useMemo(() => buildRegionStatusSummary(nodes), [nodes]);
  const t = translations[lang];
  const effectiveDesktop = isModal || isDesktop;

  const activeRegionsByMapName = useMemo(
    () => new Map(summary.regions.map((region) => [region.mapName, region])),
    [summary.regions],
  );

  const projectedMap = useMemo(() => {
    const countries = worldRegionMapData.countries.map((country) => {
      const activeRegion = activeRegionsByMapName.get(country.name) ?? null;
      return {
        ...country,
        activeRegion,
        marker: activeRegion ? country.smallRegionMarker : null,
      };
    });

    return {
      spherePath: worldRegionMapData.spherePath,
      graticulePath: worldRegionMapData.graticulePath,
      countries,
    };
  }, [activeRegionsByMapName]);

  const hoverRegion =
    summary.regions.find((region) => region.key === hovered?.regionKey) ?? null;
  const focusedRegion =
    summary.regions.find((region) => region.key === focusedKey) ?? null;
  const hoverPosition = hovered
    ? pendingHoverPositionRef.current ?? hovered
    : null;

  const viewBoxRef = useRef(`0 0 ${MAP_W} ${MAP_H}`);
  const [viewBox, setViewBox] = useState(viewBoxRef.current);
  const viewBoxFrameRef = useRef<number | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    viewBox: [number, number, number, number];
  } | null>(null);
  const movedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);

  const regionViewBox = useMemo(() => {
    if (!focusedRegion) return null;
    const countries = projectedMap.countries.filter(
      (country) => country.activeRegion?.key === focusedRegion.key,
    );
    if (countries.length === 0) return null;

    let x0 = Number.POSITIVE_INFINITY;
    let y0 = Number.POSITIVE_INFINITY;
    let x1 = Number.NEGATIVE_INFINITY;
    let y1 = Number.NEGATIVE_INFINITY;
    for (const country of countries) {
      const [minX, minY, maxX, maxY] = country.bounds;
      x0 = Math.min(x0, minX);
      y0 = Math.min(y0, minY);
      x1 = Math.max(x1, maxX);
      y1 = Math.max(y1, maxY);
    }

    const padX = Math.max(12, (x1 - x0) * 0.1);
    const padY = Math.max(12, (y1 - y0) * 0.1);
    const width = x1 - x0 + padX * 2;
    const height = y1 - y0 + padY * 2;
    const rawScale = Math.min(MAP_W / width, MAP_H / height);
    const scale = Math.min(8, Math.max(2.2, rawScale));
    const viewW = MAP_W / scale;
    const viewH = MAP_H / scale;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    return [cx - viewW / 2, cy - viewH / 2, viewW, viewH] as [
      number,
      number,
      number,
      number,
    ];
  }, [focusedRegion, projectedMap]);

  const animateViewBox = React.useCallback(
    (to: [number, number, number, number]) => {
      if (viewBoxFrameRef.current !== null) {
        window.cancelAnimationFrame(viewBoxFrameRef.current);
        viewBoxFrameRef.current = null;
      }

      const from = viewBoxRef.current.split(/\s+/).map(Number) as [
        number,
        number,
        number,
        number,
      ];
      const start = performance.now();
      const duration = 650;
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const next = [
          from[0] + (to[0] - from[0]) * eased,
          from[1] + (to[1] - from[1]) * eased,
          from[2] + (to[2] - from[2]) * eased,
          from[3] + (to[3] - from[3]) * eased,
        ]
          .map((value) => Math.round(value * 10) / 10)
          .join(" ");
        viewBoxRef.current = next;
        setViewBox(next);
        if (progress < 1) {
          viewBoxFrameRef.current = window.requestAnimationFrame(tick);
        } else {
          viewBoxFrameRef.current = null;
        }
      };
      viewBoxFrameRef.current = window.requestAnimationFrame(tick);
    },
    [],
  );

  const startPan = React.useCallback(
    (event: PointerEvent<SVGSVGElement>) => {
      if (!focusedKey) return;
      const rect = surfaceRef.current?.getBoundingClientRect();
      if (!rect) return;
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        viewBox: parseViewBox(viewBoxRef.current),
      };
      movedRef.current = false;
      setIsPanning(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [focusedKey],
  );

  const panMove = React.useCallback((event: PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) movedRef.current = true;

    const [vx, vy, vw, vh] = drag.viewBox;
    const nextVx = vx - (dx / rect.width) * vw;
    const nextVy = vy - (dy / rect.height) * vh;
    const next = [nextVx, nextVy, vw, vh]
      .map((value) => Math.round(value * 10) / 10)
      .join(" ");
    viewBoxRef.current = next;
    setViewBox(next);
  }, []);

  const endPan = React.useCallback(() => {
    if (dragRef.current) {
      dragRef.current = null;
      if (movedRef.current) {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }
    }
    setIsPanning(false);
  }, []);

  useEffect(() => {
    animateViewBox(regionViewBox ?? [0, 0, MAP_W, MAP_H]);
  }, [regionViewBox, animateViewBox]);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const onChange = () => {
      setIsDesktop(mq.matches);
      setHovered(null);
    };
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (isDesktop) return;
    const scroller = scrollRef.current;
    if (!scroller) return;
    const center = Math.max(0, (scroller.scrollWidth - scroller.clientWidth) / 2);
    scroller.scrollLeft = center;
  }, [isDesktop, summary.regions.length]);

  const getHoverPosition = React.useCallback(
    (event: PointerEvent<SVGElement>): Omit<HoveredRegion, "regionKey"> => {
      const surfaceRect = surfaceRef.current?.getBoundingClientRect();
      const boundsWidth = surfaceRect?.width ?? window.innerWidth;
      const boundsHeight = surfaceRect?.height ?? window.innerHeight;
      const x = surfaceRect ? event.clientX - surfaceRect.left : event.clientX;
      const y = surfaceRect ? event.clientY - surfaceRect.top : event.clientY;
      const hoverCard = hoverCardRef.current;
      const cardWidth =
        hoverCard?.offsetWidth ??
        Math.min(
          HOVER_CARD_MAX_WIDTH,
          Math.max(0, boundsWidth - HOVER_CARD_EDGE_PADDING * 2),
        );
      const cardHeight =
        hoverCard?.offsetHeight ?? HOVER_CARD_FALLBACK_HEIGHT;
      const spaceRight = boundsWidth - x - HOVER_CARD_GAP;
      const spaceLeft = x - HOVER_CARD_GAP;
      const spaceBelow = boundsHeight - y - HOVER_CARD_GAP;
      const spaceAbove = y - HOVER_CARD_GAP;

      return {
        x,
        y,
        horizontal:
          spaceRight >= cardWidth || spaceRight >= spaceLeft ? "right" : "left",
        vertical:
          spaceBelow >= cardHeight || spaceBelow >= spaceAbove ? "below" : "above",
      };
    },
    [],
  );

  const applyHoverPosition = React.useCallback(
    (position: Omit<HoveredRegion, "regionKey">) => {
      const hoverCard = hoverCardRef.current;
      if (!hoverCard) return;

      hoverCard.style.setProperty("--zen-map-hover-x", `${position.x}px`);
      hoverCard.style.setProperty("--zen-map-hover-y", `${position.y}px`);
      hoverCard.dataset.horizontal = position.horizontal;
      hoverCard.dataset.vertical = position.vertical;
    },
    [],
  );

  const queueHoverPosition = React.useCallback(
    (position: Omit<HoveredRegion, "regionKey">) => {
      pendingHoverPositionRef.current = position;
      if (hoverFrameRef.current !== null) return;

      hoverFrameRef.current = window.requestAnimationFrame(() => {
        hoverFrameRef.current = null;
        const nextPosition = pendingHoverPositionRef.current;
        if (nextPosition) applyHoverPosition(nextPosition);
      });
    },
    [applyHoverPosition],
  );

  const updateHoveredRegion = React.useCallback(
    (event: PointerEvent<SVGElement>, region: RegionStatusRegion) => {
      const position = getHoverPosition(event);
      setHovered({ regionKey: region.key, ...position });
      queueHoverPosition(position);
    },
    [getHoverPosition, queueHoverPosition],
  );

  const updateHoverPosition = React.useCallback(
    (event: PointerEvent<SVGElement>) => {
      queueHoverPosition(getHoverPosition(event));
    },
    [getHoverPosition, queueHoverPosition],
  );

  const clearHoveredRegion = React.useCallback(() => {
    setHovered(null);
    pendingHoverPositionRef.current = null;
    if (hoverFrameRef.current !== null) {
      window.cancelAnimationFrame(hoverFrameRef.current);
      hoverFrameRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      if (hoverFrameRef.current !== null) {
        window.cancelAnimationFrame(hoverFrameRef.current);
      }
      if (viewBoxFrameRef.current !== null) {
        window.cancelAnimationFrame(viewBoxFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!focusedKey) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      setFocusedKey(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [focusedKey]);

  if (summary.totalNodes === 0) return null;

  const selectRegion = (region: RegionStatusRegion) => {
    setFocusedKey((prev) => (prev === region.key ? null : region.key));
    setHovered(null);
  };

  const exitFocus = () => setFocusedKey(null);

  const countryAriaLabel = (region: RegionStatusRegion | null, fallback: string) =>
    region
      ? formatMsg(t.mapCountrySummary, {
          name: region.label,
          total: region.total,
          online: region.online,
          offline: region.offline,
        })
      : fallback;

  return (
    <section
      aria-label={isModal || hideHeader ? undefined : t.lblNodeDistribution}
      className={isModal || embedded ? "w-full" : "w-full max-md:-mx-4 max-md:w-[calc(100%+2rem)]"}
    >
      {!isModal && !hideHeader ? (
        <div className="mb-1 flex items-center gap-3 md:mb-2.5 max-md:px-4">
          <span
            className={`${zenType.section} zen-track-tight ${zenText.subtle} font-mono uppercase shrink-0`}
          >
            {t.lblNodeDistribution}
          </span>
          <span className="h-px flex-1 bg-zen-line" aria-hidden />
          <span
            className={`md:hidden shrink-0 ${zenType.caption} ${zenText.subtle} font-mono normal-case tracking-normal`}
          >
            {t.mapScrollHint}
          </span>
        </div>
      ) : null}

      {isModal ? (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 font-mono">
          <span
            className={`rounded-sm border border-zen-line px-1.5 py-0.5 text-[0.6875rem] ${zenText.muted}`}
          >
            {formatMsg(t.mapServers, { count: summary.totalNodes })}
          </span>
          <span className="rounded-sm border border-zen-success/30 bg-zen-success/10 px-1.5 py-0.5 text-[0.6875rem] text-zen-success">
            {formatMsg(t.mapOnlineCount, { count: summary.onlineNodes })}
          </span>
          <span className="rounded-sm border border-zen-danger/30 bg-zen-danger/10 px-1.5 py-0.5 text-[0.6875rem] text-zen-danger">
            {formatMsg(t.mapOfflineCount, { count: summary.offlineNodes })}
          </span>
          <span
            className={`rounded-sm border border-zen-line px-1.5 py-0.5 text-[0.6875rem] ${zenText.muted}`}
          >
            {formatMsg(t.mapActiveCountries, { count: summary.regions.length })}
          </span>
        </div>
      ) : null}

      <div
        className="zen-region-map__focus-layout"
        data-focused={focusedRegion ? "true" : "false"}
      >
        <div className={isModal ? "min-w-0" : "min-w-0 max-md:relative"}>
          {!isModal ? (
            <>
              <div
                className={`pointer-events-none absolute inset-y-0 left-0 z-[1] w-5 md:hidden bg-gradient-to-r ${
                  theme === "dark" ? "from-zen-bg/95" : "from-zen-bg/90"
                } to-transparent`}
                aria-hidden
              />
              <div
                className={`pointer-events-none absolute inset-y-0 right-0 z-[1] w-6 md:hidden bg-gradient-to-l ${
                  theme === "dark" ? "from-zen-bg/95" : "from-zen-bg/90"
                } to-transparent`}
                aria-hidden
              />
            </>
          ) : null}

        <div
          ref={scrollRef}
          className={
            isModal
              ? undefined
              : "max-md:overflow-x-auto max-md:overscroll-x-contain max-md:snap-x max-md:snap-mandatory max-md:touch-auto max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden"
          }
        >
          <div
            className={
              isModal
                ? "relative mx-auto aspect-[25/14] w-full touch-manipulation"
                : "relative mx-auto aspect-[25/14] touch-manipulation max-md:min-w-[720px] max-md:w-[720px] max-md:shrink-0 max-md:snap-center md:w-full"
            }
            style={
              !effectiveDesktop
                ? { width: MOBILE_MAP_WIDTH, minWidth: MOBILE_MAP_WIDTH }
                : undefined
            }
          >
            <div
              ref={surfaceRef}
              className="zen-region-map__surface absolute inset-0"
            >
              <svg
                viewBox={viewBox}
                className={`zen-region-map__svg${
                  focusedKey ? " cursor-grab touch-none" : ""
                }${isPanning ? " cursor-grabbing" : ""}`}
                role="img"
                aria-label={t.lblNodeDistribution}
                onPointerDown={startPan}
                onPointerMove={panMove}
                onPointerUp={endPan}
                onPointerCancel={endPan}
                onPointerLeave={endPan}
              >
                <path
                  d={projectedMap.spherePath}
                  className={`zen-region-map__ocean${
                    focusedKey ? " cursor-pointer" : ""
                  }`}
                  onClick={
                    focusedKey
                      ? () => {
                          if (!suppressClickRef.current) exitFocus();
                        }
                      : undefined
                  }
                />
                <g>
                  <path
                    d={projectedMap.graticulePath}
                    className="zen-region-map__graticule"
                  />

                  <g>
                    {projectedMap.countries.map((country) => {
                      const region = country.activeRegion;
                      const isSelected =
                        hovered?.regionKey === region?.key ||
                        focusedKey === region?.key;

                      return (
                        <g key={country.name}>
                          <path
                            d={country.pathData}
                            className={`zen-region-map__country${
                              region ? " is-active" : ""
                            }${region ? ` status-${region.status}` : ""}${
                              isSelected ? " is-selected" : ""
                            }`}
                            aria-label={countryAriaLabel(region, country.name)}
                            onPointerEnter={
                              region
                                ? (event) => updateHoveredRegion(event, region)
                                : undefined
                            }
                            onPointerMove={
                              region ? updateHoverPosition : undefined
                            }
                            onPointerLeave={
                              region ? clearHoveredRegion : undefined
                            }
                            onClick={
                              region
                                ? () => {
                                    if (!suppressClickRef.current) {
                                      selectRegion(region);
                                    }
                                  }
                                : undefined
                            }
                          />
                        </g>
                      );
                    })}
                  </g>

                  <g>
                    {projectedMap.countries
                      .filter((country) => country.activeRegion && country.marker)
                      .map((country) => {
                        const region = country.activeRegion;
                        const marker = country.marker;
                        if (!region || !marker) return null;

                        const isSelected =
                          hovered?.regionKey === region.key ||
                          focusedKey === region.key;

                        return (
                          <g
                            key={`${country.name}-marker`}
                            className={`zen-region-map__marker status-${region.status}${
                              isSelected ? " is-selected" : ""
                            }`}
                            aria-label={countryAriaLabel(region, country.name)}
                            onPointerEnter={(event) =>
                              updateHoveredRegion(event, region)
                            }
                            onPointerMove={updateHoverPosition}
                            onPointerLeave={clearHoveredRegion}
                            onClick={() => {
                              if (!suppressClickRef.current) {
                                selectRegion(region);
                              }
                            }}
                          >
                            <circle
                              cx={marker.x}
                              cy={marker.y}
                              r="9"
                              className="zen-region-map__marker-halo"
                            />
                            <circle
                              cx={marker.x}
                              cy={marker.y}
                              r="4.2"
                              className="zen-region-map__marker-dot"
                            />
                          </g>
                        );
                      })}
                  </g>
                </g>
              </svg>

              <div className="zen-region-map__legend">
                <div className="zen-region-map__legend-card zen-region-map__legend-card--status">
                  <div className="zen-region-map__legend-items--stacked flex">
                    <span className="zen-region-map__legend-item">
                      <span className="zen-region-map__legend-dot status-online" />
                      {t.mapLegendOnline}
                    </span>
                    <span className="zen-region-map__legend-item">
                      <span className="zen-region-map__legend-dot status-partial" />
                      {t.mapLegendPartial}
                    </span>
                    <span className="zen-region-map__legend-item">
                      <span className="zen-region-map__legend-dot status-offline" />
                      {t.mapLegendOffline}
                    </span>
                  </div>
                </div>

                {summary.unmappedNodes.length > 0 ? (
                  <div className="zen-region-map__legend-card zen-region-map__legend-card--stacked">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold uppercase tracking-wider text-zen-fg-muted">
                        {t.mapUnmappedRegions}
                      </span>
                      <span className="rounded-sm border border-zen-warning/40 bg-zen-warning/10 px-1.5 py-0.5 font-mono text-[0.6875rem] text-zen-warning">
                        {formatMsg(t.mapUnmappedCount, {
                          count: summary.unmappedNodes.length,
                        })}
                      </span>
                    </div>
                    <div className="zen-region-map__legend-unmapped-list">
                      {summary.unmappedNodes.map((node) => (
                        <div
                          key={node.id}
                          className="flex items-start justify-between gap-2 rounded-sm bg-zen-elevate px-1.5 py-1"
                        >
                          <span className="min-w-0 text-[0.6875rem] font-semibold text-zen-fg-muted [overflow-wrap:anywhere]">
                            {node.flag.trim() || t.mapRegionUnknown}
                          </span>
                          <span className="min-w-0 max-w-[48%] flex-none text-right text-[0.6875rem] text-zen-fg-subtle [overflow-wrap:anywhere]">
                            {node.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {effectiveDesktop && hoverRegion && hoverPosition ? (
                <div
                  ref={hoverCardRef}
                  className="zen-region-map__hover-card"
                  data-horizontal={hoverPosition.horizontal}
                  data-vertical={hoverPosition.vertical}
                  style={
                    {
                      "--zen-map-hover-x": `${hoverPosition.x}px`,
                      "--zen-map-hover-y": `${hoverPosition.y}px`,
                    } as CSSProperties
                  }
                >
                  <RegionStatusPanel
                    region={hoverRegion}
                    lang={lang}
                    floating
                  />
                </div>
              ) : null}
            </div>
          </div>
          </div>
        </div>

        {focusedRegion ? (
          <div
            key={focusedRegion.key}
            className={`mt-3 min-w-0 md:mt-0 ${zenMotion.fadeInUp}`}
          >
            <RegionServerTable
              region={focusedRegion}
              lang={lang}
              theme={theme}
              onBack={exitFocus}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}, areRegionStatusWorldMapPropsEqual);

RegionStatusWorldMap.displayName = "RegionStatusWorldMap";

function areMapNodesEqual(
  prev: RegionStatusWorldMapNode[],
  next: RegionStatusWorldMapNode[],
): boolean {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;

  for (let i = 0; i < prev.length; i += 1) {
    const a = prev[i];
    const b = next[i];
    if (
      a.id !== b.id ||
      a.name !== b.name ||
      a.flag !== b.flag ||
      a.online !== b.online ||
      a.uptimeSec !== b.uptimeSec ||
      a.cpuUsage !== b.cpuUsage ||
      a.memoryUsed !== b.memoryUsed ||
      a.diskUsed !== b.diskUsed
    ) {
      return false;
    }
  }

  return true;
}

function areRegionStatusWorldMapPropsEqual(
  prev: RegionStatusWorldMapProps,
  next: RegionStatusWorldMapProps,
): boolean {
  return (
    prev.theme === next.theme &&
    prev.lang === next.lang &&
    prev.presentation === next.presentation &&
    prev.hideHeader === next.hideHeader &&
    prev.embedded === next.embedded &&
    areMapNodesEqual(prev.nodes, next.nodes)
  );
}
