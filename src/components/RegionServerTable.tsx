/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { translations, formatMsg } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import type { RegionStatusRegion } from "@/lib/regionStatusMap";
import { Flag } from "@/components/Flag";
import { OsIcon } from "@/components/OsIcon";
import { formatUptime } from "@/lib/formatUnits";
import { zenType } from "@/lib/typography";
import { zenBorder, zenText } from "@/lib/zenSemantics";

interface RegionServerTableProps {
  region: RegionStatusRegion;
  lang: Lang;
  theme: "light" | "dark";
  onBack: () => void;
}

function osShortText(os: string, arch: string): string {
  const osKey = os.split(/[\s,._-]+/)[0].toUpperCase() || "OS";
  let archKey = arch.toUpperCase();
  if (archKey === "AARCH64") archKey = "ARM64";
  if (archKey === "X86_64") archKey = "AMD64";
  return `${osKey} ${archKey}`.trim();
}

export function RegionServerTable({
  region,
  lang,
  theme,
  onBack,
}: RegionServerTableProps) {
  const t = translations[lang];
  const navigate = useNavigate();
  const uptimeLabels = {
    day: t.unitDay,
    hour: t.unitHour,
    minute: t.unitMin,
    second: t.unitSec,
  };

  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden rounded-sm border ${zenBorder.default} bg-zen-surface/60`}
    >
      <div
        className={`flex shrink-0 flex-wrap items-center gap-2 border-b border-zen-line px-2.5 py-2 font-mono`}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label={t.mapFocusBack}
          title={t.mapFocusBack}
          className={`inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-sm border border-zen-border-muted bg-zen-elevate/40 px-1.5 py-1 ${zenType.caption} font-bold normal-case tracking-normal ${zenText.muted} hover:border-zen-accent/40 hover:text-zen-accent transition-colors`}
        >
          <ArrowLeft size={14} strokeWidth={2.25} aria-hidden />
          <span className="hidden sm:inline">{t.mapFocusBack}</span>
        </button>

        <div className="flex min-w-0 items-center gap-2">
          <Flag flag={region.emoji} className="h-4 w-4" />
          <span className={`truncate font-bold ${zenText.primary}`}>
            {region.label}
          </span>
          <span className={`${zenType.micro} uppercase tracking-wider ${zenText.faint}`}>
            {region.flagCode}
          </span>
        </div>

        <span
          className={`ml-auto shrink-0 rounded-sm border px-1.5 py-0.5 text-[0.6875rem] font-bold ${
            region.status === "online"
              ? "border-zen-success/40 bg-zen-success/10 text-zen-success"
              : region.status === "partial"
                ? "border-zen-warning/40 bg-zen-warning/10 text-zen-warning"
                : "border-zen-danger/40 bg-zen-danger/10 text-zen-danger"
          }`}
        >
          {region.total} {t.mapNodes}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[460px] select-none border-collapse text-left">
          <thead>
            <tr
              className={`${zenText.muted} ${zenType.caption} zen-track-tight border-b border-zen-line-strong whitespace-nowrap uppercase`}
            >
              <th className="w-8 px-2 py-2">{t.status}</th>
              <th className="px-2 py-2">{t.name}</th>
              <th className="px-2 py-2">{t.os}</th>
              <th className="px-2 py-2">{t.mapUptime}</th>
            </tr>
          </thead>
          <tbody className={`${zenType.data} whitespace-nowrap font-mono`}>
            {region.nodes.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className={`py-12 text-center ${zenText.subtle} font-sans uppercase tracking-[0.2em]`}
                >
                  {formatMsg(t.mapRegionNodes, { count: 0 })}
                </td>
              </tr>
            ) : (
              region.nodes.map((node) => {
                return (
                  <tr
                    key={node.id}
                    onClick={() => navigate(`/instance/${node.id}`)}
                    className={`cursor-pointer border-b border-zen-line transition-[background-color,color] duration-300 hover:bg-zen-elevate ${
                      node.online ? "" : "opacity-40 grayscale contrast-75 select-none"
                    }`}
                  >
                    <td className="px-2 py-2.5">
                      <span
                        className={
                          node.online ? "text-zen-success" : "text-zen-danger"
                        }
                        aria-hidden
                      >
                        {node.online ? "●" : "○"}
                      </span>
                    </td>
                    <td className={`px-2 py-2.5 ${zenText.primary}`}>
                      <span className="flex min-w-0 items-center gap-2">
                        <Flag flag={node.flag} className="h-4 w-4 shrink-0" />
                        <span
                          className="max-w-[220px] truncate font-sans font-bold"
                          title={node.name}
                        >
                          {node.name}
                        </span>
                      </span>
                    </td>
                    <td className={`px-2 py-2.5 ${zenText.muted}`}>
                      <span className="inline-flex items-center gap-1.5">
                        <OsIcon os={node.os} />
                        {osShortText(node.os, node.arch)}
                      </span>
                    </td>
                    <td className={`px-2 py-2.5 ${zenText.muted}`}>
                      {formatUptime(node.uptimeSec, uptimeLabels)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
