/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React, { lazy, Suspense } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { NodeTable } from "@/components/NodeTable";
import type { AppOutletContext } from "@/layouts/AppLayout";
import { useThemeSettings } from "@/hooks/useThemeSettings";

const NodeDistributionMap = lazy(() =>
  import("@/components/NodeDistributionMap").then((m) => ({
    default: m.NodeDistributionMap,
  })),
);

const RegionStatusWorldMap = lazy(() =>
  import("@/components/RegionStatusWorldMap").then((m) => ({
    default: m.RegionStatusWorldMap,
  })),
);

export default function DashboardPage() {
  const navigate = useNavigate();
  const { nodes, lang, theme } = useOutletContext<AppOutletContext>();
  const { showNodeMap, worldMapStyle } = useThemeSettings();

  return (
    <div className="space-y-2 md:space-y-3">
      {showNodeMap ? (
        <Suspense fallback={null}>
          {worldMapStyle === "Deer" ? (
            <RegionStatusWorldMap
              nodes={nodes}
              theme={theme}
              lang={lang}
            />
          ) : (
            <NodeDistributionMap
              nodes={nodes}
              theme={theme}
              lang={lang}
            />
          )}
        </Suspense>
      ) : null}
      <NodeTable
        nodes={nodes}
        selectedNodeId={null}
        onSelectNode={(node) => navigate(`/instance/${node.id}`)}
        lang={lang}
        theme={theme}
      />
    </div>
  );
}
