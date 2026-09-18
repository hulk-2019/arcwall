export type CoverTileKind = "image" | "video";

export type CoverTileSource = {
  type: string;
  config?: {
    storageKey?: string;
    mediaType?: string;
  };
  output?: {
    kind?: string;
    storageKeys?: string[];
  } | null;
};

export type CoverTile = {
  kind: CoverTileKind;
  storageKey: string;
};

export function collectCoverTiles(nodes: CoverTileSource[], limit = 4): CoverTile[] {
  const tiles: CoverTile[] = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    for (const tile of tilesFromNode(node)) {
      if (seen.has(tile.storageKey)) continue;
      seen.add(tile.storageKey);
      tiles.push(tile);
      if (tiles.length >= limit) return tiles;
    }
  }

  return tiles;
}

function tilesFromNode(node: CoverTileSource): CoverTile[] {
  if (node.type === "upload") {
    const mediaType = node.config?.mediaType;
    if (mediaType === "audio") return [];
    const key = node.config?.storageKey;
    if (!key) return [];
    return [{ kind: mediaType === "video" ? "video" : "image", storageKey: key }];
  }

  if (node.type !== "image" && node.type !== "video") return [];

  return (node.output?.storageKeys ?? [])
    .filter((key): key is string => Boolean(key))
    .map((storageKey) => ({ kind: node.type as CoverTileKind, storageKey }));
}
