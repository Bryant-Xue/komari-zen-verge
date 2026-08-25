/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React, { useEffect, useState } from "react";
import { resolveCountryCode } from "@/lib/regionCode";

interface FlagProps {
  flag: string;
  className?: string;
}

function resolveFlagFileName(flag: string): string {
  return resolveCountryCode(flag) ?? "UN";
}

const flagDataUrlCache = new Map<string, string>();
const flagRequestCache = new Map<string, Promise<string>>();

function flagAssetUrl(fileName: string): string {
  return `/assets/flags/${fileName}.svg`;
}

function loadFlagDataUrl(fileName: string): Promise<string> {
  const cached = flagDataUrlCache.get(fileName);
  if (cached) return Promise.resolve(cached);

  const pending = flagRequestCache.get(fileName);
  if (pending) return pending;

  const request = fetch(flagAssetUrl(fileName))
    .then((response) => {
      if (!response.ok) throw new Error(`flag ${fileName} not found`);
      return response.blob();
    })
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      flagDataUrlCache.set(fileName, url);
      flagRequestCache.delete(fileName);
      return url;
    })
    .catch((error) => {
      flagRequestCache.delete(fileName);
      throw error;
    });

  flagRequestCache.set(fileName, request);
  return request;
}

export const Flag = React.memo(({ flag, className = "w-4 h-4" }: FlagProps) => {
  const resolvedFlagFileName = resolveFlagFileName(flag);
  const assetUrl = flagAssetUrl(resolvedFlagFileName);
  const [src, setSrc] = useState(
    () => flagDataUrlCache.get(resolvedFlagFileName) ?? assetUrl,
  );
  const altText = `地区旗帜: ${resolvedFlagFileName}`;

  useEffect(() => {
    let active = true;
    const cached = flagDataUrlCache.get(resolvedFlagFileName);
    if (cached) {
      setSrc(cached);
      return;
    }

    loadFlagDataUrl(resolvedFlagFileName)
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setSrc(assetUrl);
      });

    return () => {
      active = false;
    };
  }, [resolvedFlagFileName, assetUrl]);

  return (
    <span
      className={`inline-flex shrink-0 items-center self-center ${className}`}
      aria-label={altText}
    >
      <img
        src={src}
        alt={altText}
        className="h-full w-full object-contain"
      />
    </span>
  );
});

Flag.displayName = "Flag";
