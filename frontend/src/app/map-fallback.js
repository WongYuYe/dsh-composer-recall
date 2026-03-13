import {
  LOGICAL_MAP_HEIGHT,
  LOGICAL_MAP_WIDTH,
  MAP_HEIGHT,
  MAP_RENDER_SCALE,
  MAP_WIDTH,
} from "./runtime-config.js";

function setTile(grid, x, y, type) {
  const height = grid.length;
  const width = grid[0]?.length || 0;

  if (x < 0 || y < 0 || x >= width || y >= height) {
    return;
  }

  grid[y][x] = type;
}

function fillRect(grid, x, y, width, height, type) {
  for (let row = y; row < y + height; row += 1) {
    for (let col = x; col < x + width; col += 1) {
      setTile(grid, col, row, type);
    }
  }
}

function setRowPattern(grid, y, x, pattern) {
  pattern.forEach((type, index) => {
    setTile(grid, x + index, y, type);
  });
}

function drawFenceRect(grid, x, y, width, height, type = "fence-white") {
  for (let row = y; row < y + height; row += 1) {
    for (let col = x; col < x + width; col += 1) {
      const isEdge = row === y || row === y + height - 1 || col === x || col === x + width - 1;
      if (isEdge) {
        setTile(grid, col, row, type);
      }
    }
  }
}

function resolveScaledTile(type, dx, dy) {
  const center = Math.floor(MAP_RENDER_SCALE / 2);

  if (type === "grass" || type === "grass-alt" || type === "path") {
    return type;
  }

  if (type === "flower") {
    return dx === center && dy === center ? "flower" : "grass";
  }

  if (type === "lamp") {
    if (dx !== center) {
      return "path";
    }

    if (dy === 0) {
      return "lamp-top";
    }

    if (dy < MAP_RENDER_SCALE - 1) {
      return "lamp-post";
    }

    return "lamp-base";
  }

  if (type.startsWith("npc-")) {
    if (dx !== center) {
      return "path";
    }

    if (dy === 0) {
      return `${type}-head`;
    }

    if (dy < MAP_RENDER_SCALE - 1) {
      return `${type}-body`;
    }

    return `${type}-shadow`;
  }

  return type;
}

function upscaleMapData(logicalGrid) {
  return Array.from({ length: MAP_HEIGHT }, (_, renderY) =>
    Array.from({ length: MAP_WIDTH }, (_, renderX) => {
      const sourceX = Math.floor(renderX / MAP_RENDER_SCALE);
      const sourceY = Math.floor(renderY / MAP_RENDER_SCALE);
      const dx = renderX % MAP_RENDER_SCALE;
      const dy = renderY % MAP_RENDER_SCALE;
      const sourceType = logicalGrid[sourceY]?.[sourceX] || "grass";

      return resolveScaledTile(sourceType, dx, dy);
    }),
  );
}

export function buildMapData() {
  const grid = Array.from({ length: LOGICAL_MAP_HEIGHT }, (_, y) =>
    Array.from({ length: LOGICAL_MAP_WIDTH }, (_, x) => ((x + y) % 2 === 0 ? "grass" : "grass-alt")),
  );

  fillRect(grid, 0, 0, LOGICAL_MAP_WIDTH, 1, "tree");
  fillRect(grid, 0, LOGICAL_MAP_HEIGHT - 1, LOGICAL_MAP_WIDTH, 1, "tree");
  fillRect(grid, 0, 1, 1, LOGICAL_MAP_HEIGHT - 2, "tree");
  fillRect(grid, LOGICAL_MAP_WIDTH - 1, 1, 1, LOGICAL_MAP_HEIGHT - 2, "tree");
  fillRect(grid, 1, 1, 3, 2, "tree");
  fillRect(grid, 7, 1, 2, 2, "tree");
  fillRect(grid, 17, 1, 2, 2, "tree");
  fillRect(grid, 20, 1, 3, 2, "tree");
  fillRect(grid, 1, 13, 1, 3, "tree");
  fillRect(grid, 22, 12, 1, 4, "tree");

  fillRect(grid, 3, 10, 19, 2, "path");
  fillRect(grid, 4, 7, 2, 3, "path");
  fillRect(grid, 12, 7, 2, 3, "path");
  fillRect(grid, 19, 8, 2, 2, "path");

  fillRect(grid, 2, 2, 6, 1, "roof-rest");
  fillRect(grid, 2, 3, 6, 2, "roof-rest");
  fillRect(grid, 2, 5, 6, 2, "wall");
  setRowPattern(grid, 5, 3, ["window", "window", "window", "window"]);
  setRowPattern(grid, 6, 4, ["door", "door"]);
  drawFenceRect(grid, 1, 1, 8, 8);
  setTile(grid, 4, 8, "gate");
  setTile(grid, 5, 8, "gate");
  setTile(grid, 1, 9, "mailbox");
  setTile(grid, 7, 9, "bench");
  setTile(grid, 8, 9, "sign");
  setTile(grid, 2, 8, "flower");
  setTile(grid, 7, 8, "flower");
  setTile(grid, 8, 5, "shadow-grass");

  fillRect(grid, 10, 2, 7, 1, "roof-work");
  fillRect(grid, 10, 3, 7, 2, "roof-work");
  fillRect(grid, 10, 5, 7, 1, "work-facade-shadow");
  setRowPattern(grid, 6, 10, ["work-wall-side", "work-window-frame", "work-window-frame", "work-signboard", "work-window-frame", "work-window-frame", "work-wall-side"]);
  setRowPattern(grid, 7, 10, ["work-wall-side", "work-awning", "work-awning", "work-awning", "work-awning", "work-awning", "work-wall-side"]);
  setRowPattern(grid, 8, 10, ["work-wall-side", "window", "work-door-shadow", "work-door-shadow", "work-door-shadow", "window", "work-wall-side"]);
  fillRect(grid, 10, 13, 7, 3, "grass");
  drawFenceRect(grid, 10, 13, 7, 3);
  fillRect(grid, 12, 14, 3, 1, "path");
  setTile(grid, 11, 14, "bench");
  setTile(grid, 15, 14, "bench");
  setTile(grid, 12, 13, "flower");
  setTile(grid, 14, 13, "flower");
  setTile(grid, 16, 13, "status-light");
  setTile(grid, 17, 5, "shadow-grass");
  setTile(grid, 17, 6, "shadow-grass");
  setTile(grid, 9, 9, "sign");
  setTile(grid, 10, 9, "flower");
  setTile(grid, 13, 9, "sign");

  fillRect(grid, 19, 3, 4, 1, "roof-grey");
  fillRect(grid, 19, 4, 4, 1, "roof-alert");
  fillRect(grid, 19, 5, 4, 2, "wall");
  setRowPattern(grid, 6, 20, ["door", "door"]);
  drawFenceRect(grid, 18, 8, 5, 8);
  setTile(grid, 18, 10, "gate");
  setTile(grid, 18, 11, "gate");
  fillRect(grid, 19, 12, 3, 2, "hazard");
  fillRect(grid, 19, 9, 3, 1, "alarm-floor");
  fillRect(grid, 19, 10, 3, 1, "alert-console");
  fillRect(grid, 19, 11, 3, 1, "alert-screen");
  fillRect(grid, 20, 14, 2, 1, "alarm-cabinet");
  setTile(grid, 19, 8, "alert-light");
  setTile(grid, 21, 8, "alert-light");
  setTile(grid, 22, 9, "beacon");
  setTile(grid, 22, 13, "beacon");
  setTile(grid, 22, 6, "shadow-grass");

  fillRect(grid, 1, 13, 4, 4, "pond");
  setTile(grid, 2, 14, "rock");
  setTile(grid, 3, 15, "rock");

  setTile(grid, 9, 10, "lamp");
  setTile(grid, 17, 10, "lamp");
  setTile(grid, 6, 12, "flower");
  setTile(grid, 8, 12, "flower");
  setTile(grid, 18, 12, "flower");

  return upscaleMapData(grid);
}

export function toRenderedPosition(position) {
  return {
    x: Math.min((position.x * MAP_RENDER_SCALE) + Math.floor(MAP_RENDER_SCALE / 2), MAP_WIDTH - 2),
    y: Math.min((position.y * MAP_RENDER_SCALE) + Math.floor(MAP_RENDER_SCALE / 2), MAP_HEIGHT - 2),
  };
}
