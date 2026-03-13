export const TILE_SIZE = 32;
export const ROOM_SCALE = 2;
export const ROOM_TILE_SIZE = TILE_SIZE * ROOM_SCALE;
export const TOWN_TILES = 40;
export const TOWN_WORLD_SIZE = TILE_SIZE * TOWN_TILES;
export const ROOM_TILES_W = 20;
export const ROOM_TILES_H = 16;
export const ROOM_WORLD_W = ROOM_TILE_SIZE * ROOM_TILES_W;
export const ROOM_WORLD_H = ROOM_TILE_SIZE * ROOM_TILES_H;
export const STATUS_MAP_WIDTH = 24;
export const STATUS_MAP_HEIGHT = 18;
export const PREVIEW_DURATION_MS = 880;
export const OUTDOOR_PATROL_STEP_MS = 430;
export const OUTDOOR_IDLE_PAUSE_MS = 140;
export const DOOR_OPEN_MS = 260;
export const INDOOR_SETTLE_MS = 140;

export const ROOM_THEMES = {
  rest: {
    title: "休息区",
    wallTexture: "room-wall-rest",
    floorTexture: "room-floor-rest",
    rugTexture: "room-rug-rest",
    plaqueFill: "#1b2430",
    plaqueStroke: "#f1a14d",
    shadow: 0x171d22,
  },
  work: {
    title: "工作区",
    wallTexture: "room-wall-work",
    floorTexture: "room-floor-work",
    rugTexture: "room-rug-work",
    plaqueFill: "#10232f",
    plaqueStroke: "#7bc8ff",
    shadow: 0x131b21,
  },
  alarm: {
    title: "警报区",
    wallTexture: "room-wall-alarm",
    floorTexture: "room-floor-alarm",
    rugTexture: "room-rug-alarm",
    plaqueFill: "#231720",
    plaqueStroke: "#ff9a7d",
    shadow: 0x111419,
  },
};

export const TOWN_ZONE_RECTS = {
  rest: { x: 4, y: 12, width: 7, height: 6, color: 0xf1a14d },
  work: { x: 13, y: 12, width: 8, height: 6, color: 0x7bc8ff },
  alarm: { x: 24, y: 8, width: 7, height: 7, color: 0xff8d68 },
};

export const TOWN_ZONE_LABELS = {
  rest: { text: "休息区", x: 7.2, y: 11.2, fill: "#121d24", stroke: "#f1a14d" },
  work: { text: "工作区", x: 17, y: 11.2, fill: "#10202b", stroke: "#7bc8ff" },
  alarm: { text: "警报区", x: 27.5, y: 7.2, fill: "#1f1820", stroke: "#ff9a7d" },
};

export const TOWN_ALARM_HOUSE = {
  x: 25,
  y: 9,
  width: 5,
  height: 5,
};

export const TOWN_ALERT_LIGHT_TILES = [
  { x: 26, y: 10 },
  { x: 29, y: 10 },
];

export const TOWN_PREVIEW_BOUNDS = {
  rest: { minX: 5, maxX: 8, minY: 13, maxY: 16 },
  work: { minX: 15, maxX: 18, minY: 13, maxY: 16 },
  alarm: { minX: 26, maxX: 29, minY: 10, maxY: 13 },
};

export const TOWN_PATROL_ROUTES = {
  rest: [{ x: 5, y: 15 }, { x: 8, y: 15 }, { x: 6, y: 15 }],
  work: [{ x: 15, y: 15 }, { x: 18, y: 15 }, { x: 15, y: 15 }],
  alarm: [{ x: 24, y: 15 }, { x: 27, y: 15 }, { x: 29, y: 15 }, { x: 27, y: 15 }],
};

export const OUTDOOR_ACTIVITY_ROUTES = {
  stay_home: [{ x: 6, y: 15 }, { x: 8, y: 15 }, { x: 8, y: 17 }, { x: 6, y: 17 }],
  walk: [{ x: 6, y: 15 }, { x: 10, y: 15 }, { x: 14, y: 15 }, { x: 18, y: 17 }, { x: 14, y: 19 }, { x: 9, y: 19 }, { x: 6, y: 17 }],
  stroll: [{ x: 7, y: 15 }, { x: 11, y: 15 }, { x: 16, y: 15 }, { x: 20, y: 17 }, { x: 16, y: 19 }, { x: 10, y: 19 }, { x: 7, y: 17 }],
  walk_dog: [{ x: 6, y: 15 }, { x: 8, y: 17 }, { x: 11, y: 19 }, { x: 9, y: 21 }, { x: 6, y: 20 }, { x: 5, y: 17 }],
  supermarket: [{ x: 7, y: 15 }, { x: 12, y: 15 }, { x: 18, y: 15 }, { x: 22, y: 15 }, { x: 24, y: 17 }, { x: 21, y: 19 }, { x: 16, y: 19 }, { x: 11, y: 17 }],
  town: [{ x: 6, y: 15 }, { x: 11, y: 15 }, { x: 17, y: 15 }, { x: 23, y: 15 }, { x: 25, y: 18 }, { x: 20, y: 20 }, { x: 13, y: 20 }, { x: 7, y: 18 }],
  park: [{ x: 6, y: 15 }, { x: 9, y: 17 }, { x: 12, y: 19 }, { x: 10, y: 21 }, { x: 7, y: 20 }, { x: 6, y: 18 }],
  coffee: [{ x: 7, y: 15 }, { x: 11, y: 15 }, { x: 15, y: 15 }, { x: 19, y: 15 }, { x: 17, y: 17 }, { x: 12, y: 17 }],
};

export const TOWN_ZONE_DOORS = {
  rest: {
    walkTo: { x: 6, y: 15 },
    anchor: { x: 6, y: 14.18 },
  },
  work: {
    walkTo: { x: 16, y: 15 },
    anchor: { x: 16, y: 14.18 },
  },
  alarm: {
    walkTo: { x: 27, y: 15 },
    anchor: { x: 27, y: 12.38 },
  },
};

export const ROOM_ENTRY_TILES = {
  rest: { x: 10, y: 13 },
  work: { x: 10, y: 13 },
  alarm: { x: 10, y: 13 },
};
