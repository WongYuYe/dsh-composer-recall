import { ROOM_TILE_SIZE, TILE_SIZE } from "./constants.js";

export function tileToWorldX(tileX) {
  return (tileX + 0.5) * TILE_SIZE;
}

export function tileToWorldY(tileY) {
  return (tileY + 1) * TILE_SIZE;
}

export function roomTileToWorldX(tileX) {
  return (tileX + 0.5) * ROOM_TILE_SIZE;
}

export function roomTileToWorldY(tileY) {
  return (tileY + 1) * ROOM_TILE_SIZE;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function sameTilePosition(left, right) {
  if (!left || !right) {
    return false;
  }

  return Math.abs(left.x - right.x) < 0.01 && Math.abs(left.y - right.y) < 0.01;
}

export function projectIntoBounds(position, bounds, width, height) {
  if (!position || !bounds) {
    return position;
  }

  const xRatio = clamp((position.x - 1) / Math.max(width - 3, 1), 0, 1);
  const yRatio = clamp((position.y - 1) / Math.max(height - 3, 1), 0, 1);

  return {
    x: Math.round(bounds.minX + ((bounds.maxX - bounds.minX) * xRatio)),
    y: Math.round(bounds.minY + ((bounds.maxY - bounds.minY) * yRatio)),
  };
}

export function squareStyle(fill, stroke, fontSize = "14px") {
  return {
    backgroundColor: fill,
    color: stroke,
    fontFamily: "monospace",
    fontSize,
    fontStyle: "bold",
    padding: { x: 8, y: 4 },
    resolution: 2,
  };
}

export function drawPixelRect(ctx, x, y, width, height, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

export function createCanvasTexture(scene, key, width, height, draw) {
  if (scene.textures.exists(key)) {
    return;
  }

  const texture = scene.textures.createCanvas(key, width, height);
  const ctx = texture.context;
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  texture.refresh();
}
