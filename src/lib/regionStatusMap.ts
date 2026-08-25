/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import { resolveCountryCode } from "@/lib/regionCode";
import type { VPSNode } from "@/types";

export type RegionStatus = "online" | "offline" | "partial";

export type RegionStatusMapNode = Pick<
  VPSNode,
  | "id"
  | "name"
  | "flag"
  | "online"
  | "uptimeSec"
  | "cpuUsage"
  | "memoryTotal"
  | "memoryUsed"
  | "diskTotal"
  | "diskUsed"
  | "os"
  | "arch"
>;

export type RegionStatusRegion = {
  emoji: string;
  key: string;
  label: string;
  mapName: string;
  flagCode: string;
  total: number;
  online: number;
  offline: number;
  status: RegionStatus;
  nodes: RegionStatusMapNode[];
};

export type RegionStatusSummary = {
  regions: RegionStatusRegion[];
  totalNodes: number;
  onlineNodes: number;
  offlineNodes: number;
  unmappedNodes: RegionStatusMapNode[];
};

type RegionMeta = {
  key: string;
  label: string;
  mapName: string;
  flagCode: string;
};

const REGION_META_OVERRIDES: Record<
  string,
  Partial<Pick<RegionMeta, "label" | "mapName">>
> = {
  US: { label: "United States", mapName: "United States of America" },
  TR: { label: "Turkey", mapName: "Turkey" },
  MO: { label: "Macau", mapName: "Macao" },
  HK: { label: "Hong Kong", mapName: "Hong Kong" },
};

const englishRegionDisplayNames =
  typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

function getRegionStatus(online: number, offline: number): RegionStatus {
  if (online === 0) return "offline";
  if (offline === 0) return "online";
  return "partial";
}

function resolveRegionMetaFromFlagCode(flagCode: string): RegionMeta | null {
  if (flagCode === "UN") return null;

  const displayName = englishRegionDisplayNames?.of(flagCode)?.trim();
  if (!displayName) return null;

  const overrides = REGION_META_OVERRIDES[flagCode];
  return {
    key: flagCode,
    label: overrides?.label ?? displayName,
    mapName: overrides?.mapName ?? displayName,
    flagCode,
  };
}

export function buildRegionStatusSummary(
  nodes: RegionStatusMapNode[],
): RegionStatusSummary {
  const regionMap = new Map<string, RegionStatusRegion>();
  const unmappedNodes: RegionStatusMapNode[] = [];

  for (const node of nodes) {
    const code = resolveCountryCode(node.flag);
    const regionMeta = code ? resolveRegionMetaFromFlagCode(code) : null;

    if (!regionMeta) {
      unmappedNodes.push(node);
      continue;
    }

    const existing = regionMap.get(regionMeta.key);
    if (existing) {
      existing.nodes.push(node);
      existing.total += 1;
      if (node.online) existing.online += 1;
      else existing.offline += 1;
      existing.status = getRegionStatus(existing.online, existing.offline);
      continue;
    }

    regionMap.set(regionMeta.key, {
      emoji: node.flag,
      key: regionMeta.key,
      label: regionMeta.label,
      mapName: regionMeta.mapName,
      flagCode: regionMeta.flagCode,
      total: 1,
      online: node.online ? 1 : 0,
      offline: node.online ? 0 : 1,
      status: node.online ? "online" : "offline",
      nodes: [node],
    });
  }

  const regions = Array.from(regionMap.values()).sort((left, right) => {
    if (right.total !== left.total) return right.total - left.total;
    if (right.online !== left.online) return right.online - left.online;
    return left.label.localeCompare(right.label);
  });

  const onlineNodes = nodes.filter((node) => node.online).length;

  return {
    regions,
    totalNodes: nodes.length,
    onlineNodes,
    offlineNodes: nodes.length - onlineNodes,
    unmappedNodes,
  };
}
