import Phaser from "phaser";
import atlasImageUrl from "../../assets/phaser/atlas/atlas.png";
import atlasJsonUrl from "../../assets/phaser/atlas/atlas.json?url";
import townMapUrl from "../../assets/phaser/tilemaps/town.json?url";
import tilesetUrl from "../../assets/phaser/tilesets/tuxemon.png";

import {
  DOOR_OPEN_MS,
  INDOOR_SETTLE_MS,
  OUTDOOR_ACTIVITY_ROUTES,
  OUTDOOR_IDLE_PAUSE_MS,
  OUTDOOR_PATROL_STEP_MS,
  PREVIEW_DURATION_MS,
  ROOM_ENTRY_TILES,
  ROOM_SCALE,
  ROOM_THEMES,
  ROOM_TILE_SIZE,
  ROOM_TILES_H,
  ROOM_TILES_W,
  ROOM_WORLD_H,
  ROOM_WORLD_W,
  STATUS_MAP_HEIGHT,
  STATUS_MAP_WIDTH,
  TILE_SIZE,
  TOWN_ALERT_LIGHT_TILES,
  TOWN_ALARM_HOUSE,
  TOWN_PATROL_ROUTES,
  TOWN_PREVIEW_BOUNDS,
  TOWN_TILES,
  TOWN_WORLD_SIZE,
  TOWN_ZONE_DOORS,
  TOWN_ZONE_LABELS,
  TOWN_ZONE_RECTS,
} from "./constants.js";
import {
  clamp,
  createCanvasTexture,
  drawPixelRect,
  projectIntoBounds,
  roomTileToWorldX,
  roomTileToWorldY,
  sameTilePosition,
  squareStyle,
  tileToWorldX,
  tileToWorldY,
} from "./helpers.js";

(() => {
  let game = null;
  let sceneRef = null;
  let pendingState = null;
  const TOWN_AGENT_SLOTS = {
    rest: [
      { x: 6.0, y: 15.0 },
      { x: 7.2, y: 15.8 },
      { x: 5.3, y: 16.0 },
      { x: 7.8, y: 14.6 },
    ],
    work: [
      { x: 16.0, y: 15.0 },
      { x: 17.2, y: 15.8 },
      { x: 15.2, y: 16.0 },
      { x: 17.8, y: 14.6 },
    ],
    alarm: [
      { x: 27.0, y: 14.8 },
      { x: 28.0, y: 15.6 },
      { x: 26.0, y: 15.5 },
      { x: 28.2, y: 13.8 },
    ],
  };
  const ROOM_LOCAL_AGENT_SLOTS = {
    rest: [
      { x: 7.2, y: 13.6 },
      { x: 9.6, y: 12.7 },
      { x: 14.8, y: 12.9 },
      { x: 16.4, y: 13.8 },
    ],
    work: [
      { x: 7.4, y: 13.1 },
      { x: 9.7, y: 12.3 },
      { x: 12.7, y: 12.3 },
      { x: 15.4, y: 13.3 },
    ],
    alarm: [
      { x: 7.4, y: 13.2 },
      { x: 9.8, y: 12.9 },
      { x: 13.0, y: 12.9 },
      { x: 15.6, y: 13.2 },
    ],
  };
  const ROOM_REMOTE_AGENT_SLOTS = {
    rest: [
      { x: 5.2, y: 14.9 },
      { x: 6.6, y: 14.2 },
    ],
    work: [
      { x: 9.8, y: 6.4 },
      { x: 12.2, y: 6.7 },
    ],
    alarm: [
      { x: 14.8, y: 14.8 },
      { x: 13.4, y: 14.1 },
    ],
  };
  const ROOM_AGENT_ROAM_BOUNDS = {
    rest: { minX: 6.6, maxX: 16.1, minY: 11.8, maxY: 14.4 },
    work: { minX: 7.0, maxX: 15.7, minY: 10.8, maxY: 13.7 },
    alarm: { minX: 7.0, maxX: 15.8, minY: 10.8, maxY: 13.8 },
  };

  function createRoomTextures(scene) {
    createCanvasTexture(scene, "room-floor-rest", 32, 32, (ctx) => {
      drawPixelRect(ctx, 0, 0, 32, 32, "#8f6e54");
      drawPixelRect(ctx, 0, 0, 32, 4, "#7a5d48");
      drawPixelRect(ctx, 0, 16, 32, 2, "#7a5d48");
      drawPixelRect(ctx, 0, 30, 32, 2, "#664b3c");
      drawPixelRect(ctx, 8, 0, 2, 32, "#a57d5d");
      drawPixelRect(ctx, 24, 0, 2, 32, "#a57d5d");
    });

    createCanvasTexture(scene, "room-floor-work", 32, 32, (ctx) => {
      drawPixelRect(ctx, 0, 0, 32, 32, "#9aa8ad");
      drawPixelRect(ctx, 0, 0, 32, 4, "#b8c2c7");
      drawPixelRect(ctx, 0, 16, 32, 2, "#879399");
      drawPixelRect(ctx, 16, 0, 2, 32, "#7d8a90");
      drawPixelRect(ctx, 0, 30, 32, 2, "#738087");
    });

    createCanvasTexture(scene, "room-floor-alarm", 32, 32, (ctx) => {
      drawPixelRect(ctx, 0, 0, 32, 32, "#40464c");
      drawPixelRect(ctx, 0, 0, 32, 4, "#59626a");
      drawPixelRect(ctx, 0, 16, 32, 2, "#30363d");
      drawPixelRect(ctx, 16, 0, 2, 32, "#69737c");
      drawPixelRect(ctx, 0, 30, 32, 2, "#252b32");
    });

    createCanvasTexture(scene, "room-wall-rest", 32, 32, (ctx) => {
      drawPixelRect(ctx, 0, 0, 32, 32, "#dcc9a9");
      drawPixelRect(ctx, 0, 0, 32, 8, "#eedebf");
      drawPixelRect(ctx, 0, 22, 32, 10, "#b99176");
      drawPixelRect(ctx, 0, 24, 32, 2, "#8f6e54");
      drawPixelRect(ctx, 0, 30, 32, 2, "#6a5240");
    });

    createCanvasTexture(scene, "room-wall-work", 32, 32, (ctx) => {
      drawPixelRect(ctx, 0, 0, 32, 32, "#ced9d6");
      drawPixelRect(ctx, 0, 0, 32, 8, "#eef5f3");
      drawPixelRect(ctx, 0, 22, 32, 10, "#7da1a4");
      drawPixelRect(ctx, 0, 24, 32, 2, "#4b6e74");
      drawPixelRect(ctx, 0, 30, 32, 2, "#35474c");
    });

    createCanvasTexture(scene, "room-wall-alarm", 32, 32, (ctx) => {
      drawPixelRect(ctx, 0, 0, 32, 32, "#5d636c");
      drawPixelRect(ctx, 0, 0, 32, 8, "#787f88");
      drawPixelRect(ctx, 0, 22, 32, 10, "#2a2f36");
      drawPixelRect(ctx, 0, 24, 32, 2, "#d78b51");
      drawPixelRect(ctx, 0, 30, 32, 2, "#181c21");
    });

    createCanvasTexture(scene, "room-window", 92, 34, (ctx) => {
      drawPixelRect(ctx, 0, 0, 92, 6, "#f4efe2");
      drawPixelRect(ctx, 4, 6, 84, 4, "#a47e5f");
      drawPixelRect(ctx, 0, 10, 92, 20, "#765842");
      drawPixelRect(ctx, 6, 12, 80, 14, "#a8dbff");
      drawPixelRect(ctx, 6, 12, 4, 14, "#e4f6ff");
      drawPixelRect(ctx, 6, 12, 80, 3, "#e4f6ff");
      drawPixelRect(ctx, 44, 12, 4, 14, "#d5ecf5");
      drawPixelRect(ctx, 6, 20, 80, 3, "#79abc8");
      drawPixelRect(ctx, 10, 26, 72, 4, "#5b4435");
      drawPixelRect(ctx, 0, 30, 92, 4, "#4f3b2d");
    });

    createCanvasTexture(scene, "room-door", 84, 34, (ctx) => {
      drawPixelRect(ctx, 10, 0, 64, 6, "#c39d78");
      drawPixelRect(ctx, 4, 6, 76, 4, "#8a6548");
      drawPixelRect(ctx, 0, 10, 84, 18, "#5d4332");
      drawPixelRect(ctx, 10, 10, 64, 14, "#231913");
      drawPixelRect(ctx, 14, 10, 56, 3, "#7b5b43");
      drawPixelRect(ctx, 14, 24, 56, 2, "#120d0a");
      drawPixelRect(ctx, 32, 13, 4, 11, "#765842");
      drawPixelRect(ctx, 48, 13, 4, 11, "#765842");
      drawPixelRect(ctx, 16, 28, 52, 4, "#9a775a");
      drawPixelRect(ctx, 8, 32, 68, 2, "#4e392b");
    });

    createCanvasTexture(scene, "room-rug-rest", 160, 96, (ctx) => {
      drawPixelRect(ctx, 0, 0, 160, 96, "#a96056");
      drawPixelRect(ctx, 6, 6, 148, 84, "#d9bd7b");
      drawPixelRect(ctx, 18, 18, 124, 60, "#b87863");
      drawPixelRect(ctx, 26, 26, 108, 44, "#d8c6a2");
    });

    createCanvasTexture(scene, "room-rug-work", 160, 96, (ctx) => {
      drawPixelRect(ctx, 0, 0, 160, 96, "#27556b");
      drawPixelRect(ctx, 6, 6, 148, 84, "#6dc7d8");
      drawPixelRect(ctx, 18, 18, 124, 60, "#244758");
      drawPixelRect(ctx, 26, 26, 108, 44, "#b9d5db");
    });

    createCanvasTexture(scene, "room-rug-alarm", 160, 96, (ctx) => {
      drawPixelRect(ctx, 0, 0, 160, 96, "#1f242a");
      drawPixelRect(ctx, 6, 6, 148, 84, "#ffbe55");
      drawPixelRect(ctx, 18, 18, 124, 60, "#2f343b");
      drawPixelRect(ctx, 26, 26, 108, 44, "#d05a4f");
    });

    createCanvasTexture(scene, "furniture-bed", 128, 96, (ctx) => {
      drawPixelRect(ctx, 0, 0, 128, 96, "#5a4030");
      drawPixelRect(ctx, 8, 8, 112, 18, "#efe9dc");
      drawPixelRect(ctx, 8, 26, 112, 58, "#7ba5d6");
      drawPixelRect(ctx, 16, 34, 96, 42, "#668fc4");
      drawPixelRect(ctx, 0, 84, 128, 12, "#3b2a1f");
      drawPixelRect(ctx, 0, 0, 128, 8, "#7c5b43");
    });

    createCanvasTexture(scene, "furniture-wardrobe", 80, 112, (ctx) => {
      drawPixelRect(ctx, 0, 0, 80, 112, "#7c5c43");
      drawPixelRect(ctx, 6, 8, 68, 96, "#966d4c");
      drawPixelRect(ctx, 38, 8, 4, 96, "#6a4b36");
      drawPixelRect(ctx, 28, 48, 4, 12, "#d8c78d");
      drawPixelRect(ctx, 48, 48, 4, 12, "#d8c78d");
      drawPixelRect(ctx, 0, 104, 80, 8, "#5a4030");
    });

    createCanvasTexture(scene, "furniture-nightstand", 48, 48, (ctx) => {
      drawPixelRect(ctx, 0, 0, 48, 48, "#7b583f");
      drawPixelRect(ctx, 4, 6, 40, 12, "#9b7150");
      drawPixelRect(ctx, 6, 20, 36, 22, "#815d43");
      drawPixelRect(ctx, 12, 24, 24, 2, "#5e4230");
      drawPixelRect(ctx, 10, 28, 4, 4, "#e4c98f");
    });

    createCanvasTexture(scene, "furniture-lamp", 40, 72, (ctx) => {
      drawPixelRect(ctx, 10, 0, 20, 20, "#f7d98e");
      drawPixelRect(ctx, 14, 20, 12, 6, "#e9ba68");
      drawPixelRect(ctx, 18, 26, 4, 28, "#6d5442");
      drawPixelRect(ctx, 10, 54, 20, 8, "#584234");
      drawPixelRect(ctx, 6, 62, 28, 6, "#2c221b");
    });

    createCanvasTexture(scene, "furniture-desk", 160, 96, (ctx) => {
      drawPixelRect(ctx, 0, 22, 160, 74, "#78543a");
      drawPixelRect(ctx, 0, 14, 160, 12, "#9e7150");
      drawPixelRect(ctx, 0, 0, 160, 14, "#c99667");
      drawPixelRect(ctx, 16, 0, 44, 22, "#293745");
      drawPixelRect(ctx, 18, 2, 40, 16, "#93d7ff");
      drawPixelRect(ctx, 62, 0, 36, 18, "#2a3642");
      drawPixelRect(ctx, 64, 2, 32, 12, "#7bc8ff");
      drawPixelRect(ctx, 104, 2, 18, 8, "#dcd9c8");
      drawPixelRect(ctx, 124, 2, 18, 8, "#dcd9c8");
      drawPixelRect(ctx, 14, 34, 132, 10, "#62422d");
      drawPixelRect(ctx, 18, 78, 12, 18, "#4d3425");
      drawPixelRect(ctx, 130, 78, 12, 18, "#4d3425");
    });

    createCanvasTexture(scene, "furniture-chair", 56, 56, (ctx) => {
      drawPixelRect(ctx, 10, 0, 36, 18, "#4b6377");
      drawPixelRect(ctx, 8, 18, 40, 18, "#355062");
      drawPixelRect(ctx, 18, 36, 4, 16, "#202d39");
      drawPixelRect(ctx, 34, 36, 4, 16, "#202d39");
      drawPixelRect(ctx, 12, 48, 32, 6, "#161f27");
    });

    createCanvasTexture(scene, "furniture-bookshelf", 80, 112, (ctx) => {
      drawPixelRect(ctx, 0, 0, 80, 112, "#5d432f");
      drawPixelRect(ctx, 6, 8, 68, 18, "#7a583f");
      drawPixelRect(ctx, 10, 12, 12, 10, "#be5f53");
      drawPixelRect(ctx, 24, 12, 10, 10, "#f0cb78");
      drawPixelRect(ctx, 36, 12, 10, 10, "#6ca65f");
      drawPixelRect(ctx, 48, 12, 10, 10, "#7d93d4");
      drawPixelRect(ctx, 6, 34, 68, 18, "#7a583f");
      drawPixelRect(ctx, 12, 38, 12, 10, "#7d93d4");
      drawPixelRect(ctx, 26, 38, 10, 10, "#c26b5e");
      drawPixelRect(ctx, 40, 38, 10, 10, "#e5d7b5");
      drawPixelRect(ctx, 54, 38, 10, 10, "#7d93d4");
      drawPixelRect(ctx, 6, 60, 68, 18, "#7a583f");
      drawPixelRect(ctx, 10, 64, 12, 10, "#b76851");
      drawPixelRect(ctx, 24, 64, 10, 10, "#6ca65f");
      drawPixelRect(ctx, 36, 64, 10, 10, "#f0cb78");
      drawPixelRect(ctx, 48, 64, 10, 10, "#7d93d4");
      drawPixelRect(ctx, 60, 64, 8, 10, "#d2a873");
      drawPixelRect(ctx, 6, 86, 68, 18, "#7a583f");
      drawPixelRect(ctx, 0, 104, 80, 8, "#3d2b1f");
    });

    createCanvasTexture(scene, "furniture-dresser", 112, 72, (ctx) => {
      drawPixelRect(ctx, 0, 10, 112, 52, "#7b563d");
      drawPixelRect(ctx, 0, 0, 112, 14, "#bb8a60");
      drawPixelRect(ctx, 8, 18, 96, 16, "#936849");
      drawPixelRect(ctx, 8, 38, 96, 16, "#865e43");
      drawPixelRect(ctx, 18, 24, 10, 4, "#ead2a1");
      drawPixelRect(ctx, 50, 24, 10, 4, "#ead2a1");
      drawPixelRect(ctx, 82, 24, 10, 4, "#ead2a1");
      drawPixelRect(ctx, 18, 44, 10, 4, "#ead2a1");
      drawPixelRect(ctx, 50, 44, 10, 4, "#ead2a1");
      drawPixelRect(ctx, 82, 44, 10, 4, "#ead2a1");
      drawPixelRect(ctx, 8, 62, 12, 10, "#4e3627");
      drawPixelRect(ctx, 92, 62, 12, 10, "#4e3627");
    });

    createCanvasTexture(scene, "furniture-meeting-table", 128, 64, (ctx) => {
      drawPixelRect(ctx, 0, 8, 128, 44, "#8c6446");
      drawPixelRect(ctx, 0, 0, 128, 10, "#b9855d");
      drawPixelRect(ctx, 10, 18, 108, 18, "#ceb79a");
      drawPixelRect(ctx, 16, 52, 10, 12, "#5a4030");
      drawPixelRect(ctx, 102, 52, 10, 12, "#5a4030");
    });

    createCanvasTexture(scene, "furniture-plant", 48, 64, (ctx) => {
      drawPixelRect(ctx, 10, 34, 28, 18, "#9a6f4c");
      drawPixelRect(ctx, 14, 26, 20, 8, "#b58760");
      drawPixelRect(ctx, 18, 6, 12, 26, "#40773d");
      drawPixelRect(ctx, 6, 12, 14, 18, "#5f9c56");
      drawPixelRect(ctx, 22, 10, 16, 18, "#5f9c56");
      drawPixelRect(ctx, 12, 0, 10, 12, "#7db567");
      drawPixelRect(ctx, 24, 0, 10, 12, "#7db567");
    });

    createCanvasTexture(scene, "furniture-console", 176, 96, (ctx) => {
      drawPixelRect(ctx, 0, 16, 176, 80, "#3f464d");
      drawPixelRect(ctx, 0, 0, 176, 18, "#57616c");
      drawPixelRect(ctx, 12, 4, 44, 18, "#202d39");
      drawPixelRect(ctx, 16, 8, 36, 10, "#7bc8ff");
      drawPixelRect(ctx, 66, 4, 44, 18, "#202d39");
      drawPixelRect(ctx, 70, 8, 36, 10, "#8fdc6d");
      drawPixelRect(ctx, 120, 4, 44, 18, "#202d39");
      drawPixelRect(ctx, 124, 8, 36, 10, "#ffd166");
      drawPixelRect(ctx, 18, 36, 140, 18, "#29313a");
      drawPixelRect(ctx, 18, 58, 12, 8, "#d15b50");
      drawPixelRect(ctx, 42, 58, 12, 8, "#7bc8ff");
      drawPixelRect(ctx, 66, 58, 12, 8, "#8fdc6d");
      drawPixelRect(ctx, 90, 58, 12, 8, "#d15b50");
      drawPixelRect(ctx, 114, 58, 12, 8, "#ffd166");
      drawPixelRect(ctx, 138, 58, 12, 8, "#8fdc6d");
      drawPixelRect(ctx, 24, 80, 10, 16, "#242b31");
      drawPixelRect(ctx, 142, 80, 10, 16, "#242b31");
    });

    createCanvasTexture(scene, "furniture-terminal", 112, 72, (ctx) => {
      drawPixelRect(ctx, 0, 12, 112, 48, "#364149");
      drawPixelRect(ctx, 0, 0, 112, 16, "#56616c");
      drawPixelRect(ctx, 10, 4, 28, 12, "#1b2229");
      drawPixelRect(ctx, 14, 8, 20, 6, "#7bc8ff");
      drawPixelRect(ctx, 42, 4, 28, 12, "#1b2229");
      drawPixelRect(ctx, 46, 8, 20, 6, "#8fdc6d");
      drawPixelRect(ctx, 74, 4, 28, 12, "#1b2229");
      drawPixelRect(ctx, 78, 8, 20, 6, "#ffd166");
      drawPixelRect(ctx, 12, 26, 88, 10, "#232d34");
      drawPixelRect(ctx, 18, 40, 12, 6, "#d15b50");
      drawPixelRect(ctx, 38, 40, 12, 6, "#7bc8ff");
      drawPixelRect(ctx, 58, 40, 12, 6, "#8fdc6d");
      drawPixelRect(ctx, 78, 40, 12, 6, "#ffd166");
      drawPixelRect(ctx, 18, 60, 8, 12, "#232d34");
      drawPixelRect(ctx, 86, 60, 8, 12, "#232d34");
    });

    createCanvasTexture(scene, "furniture-rack", 64, 112, (ctx) => {
      drawPixelRect(ctx, 0, 0, 64, 112, "#252d34");
      drawPixelRect(ctx, 6, 6, 52, 100, "#12181d");
      for (let i = 0; i < 5; i += 1) {
        const y = 12 + (i * 18);
        drawPixelRect(ctx, 10, y, 44, 12, "#2d3841");
        drawPixelRect(ctx, 14, y + 4, 6, 4, "#7bc8ff");
        drawPixelRect(ctx, 24, y + 4, 6, 4, "#8fdc6d");
        drawPixelRect(ctx, 34, y + 4, 6, 4, "#ffd166");
      }
      drawPixelRect(ctx, 0, 106, 64, 6, "#0d1115");
    });

    createCanvasTexture(scene, "furniture-beacon", 48, 72, (ctx) => {
      drawPixelRect(ctx, 18, 0, 12, 16, "#ff7d62");
      drawPixelRect(ctx, 14, 16, 20, 8, "#ffd3b1");
      drawPixelRect(ctx, 20, 24, 8, 28, "#48525c");
      drawPixelRect(ctx, 12, 52, 24, 10, "#262d33");
      drawPixelRect(ctx, 6, 62, 36, 8, "#11161b");
    });
  }

  class OpenClawMapScene extends Phaser.Scene {
    constructor() {
      super("OpenClawMapScene");
      this.currentView = "";
      this.currentZone = "";
      this.currentObjects = [];
      this.lastDirection = "front";
      this.moveTween = null;
      this.alertTween = null;
      this.previewTimer = null;
      this.previewZone = "";
      this.previewKey = "";
      this.transitioningRoomZone = "";
      this.sequenceId = 0;
      this.lastAppliedFocusedAgentId = "";
    }

    preload() {
      this.load.tilemapTiledJSON("openclaw-town", townMapUrl);
      this.load.image("openclaw-tiles", tilesetUrl);
      this.load.atlas("openclaw-atlas", atlasImageUrl, atlasJsonUrl);
    }

    create() {
      createRoomTextures(this);
      this.createAnimations();
      this.createActorObjects();
      sceneRef = this;

      if (pendingState) {
        this.applyState(pendingState);
      } else {
        this.buildTownView("");
      }
    }

    createAnimations() {
      const animations = [
        { key: "walk-left", prefix: "misa-left-walk." },
        { key: "walk-right", prefix: "misa-right-walk." },
        { key: "walk-back", prefix: "misa-back-walk." },
        { key: "walk-front", prefix: "misa-front-walk." },
      ];

      animations.forEach(({ key, prefix }) => {
        if (this.anims.exists(key)) {
          return;
        }

        this.anims.create({
          key,
          frames: this.anims.generateFrameNames("openclaw-atlas", {
            prefix,
            start: 0,
            end: 3,
            zeroPad: 3,
          }),
          frameRate: 10,
          repeat: -1,
        });
      });
    }

    createActorObjects() {
      this.shadow = this.add.ellipse(0, 0, 26, 10, 0x11161b, 0.34).setDepth(90).setVisible(false);
      this.player = this.add.sprite(0, 0, "openclaw-atlas", "misa-front").setDepth(91).setVisible(false);
      this.nameplate = this.add.text(0, 0, "main", squareStyle("#f7f3d6", "#15313a"))
        .setOrigin(0.5, 1)
        .setDepth(92)
        .setVisible(false);
      this.agentMarkers = [];
      this.agentMarkerMap = new Map();
      this.agentPositionMemory = new Map();
      this.focusedMarkerId = "";
      this.lastRenderedAgentIds = [];
      this.lastRenderedAgents = [];
      this.roomGlow = this.add.graphics().setDepth(70);
      this.roomGlow.setVisible(false);
      this.alertLightGraphics = this.add.graphics().setDepth(80);
      this.doorEffect = this.add.graphics().setDepth(66);
      this.transitionPanel = this.add.rectangle(ROOM_WORLD_W / 2, ROOM_WORLD_H - 68, 440, 52, 0x071117, 0.9)
        .setStrokeStyle(4, 0x7bc8ff, 0.92)
        .setDepth(190)
        .setScrollFactor(0)
        .setVisible(false);
      this.transitionText = this.add.text(ROOM_WORLD_W / 2, ROOM_WORLD_H - 68, "", squareStyle("#071117", "#f6efc7", "18px"))
        .setOrigin(0.5, 0.5)
        .setDepth(191)
        .setScrollFactor(0)
        .setVisible(false);
    }

    clearAgentMarkers() {
      (this.agentMarkers || []).forEach((node) => this.destroyAgentMarker(node));
      this.agentMarkers = [];
      this.agentMarkerMap = new Map();
      this.focusedMarkerId = "";
      this.lastRenderedAgentIds = [];
      this.lastRenderedAgents = [];
    }

    stopAgentMarkerMotion(node) {
      if (node?.__agentTimer && typeof node.__agentTimer.remove === "function") {
        node.__agentTimer.remove(false);
        node.__agentTimer = null;
      }
      if (node?.__agentTween && typeof node.__agentTween.stop === "function") {
        node.__agentTween.stop();
        node.__agentTween = null;
      }
    }

    destroyAgentMarker(node) {
      if (node?.__agentId) {
        this.rememberAgentWorldPosition(
          node.__agentId,
          node.__agentZone || "",
          node.x,
          node.y,
          Boolean(node.__isTownView),
        );
      }
      this.stopAgentMarkerMotion(node);
      if (node && typeof node.destroy === "function") {
        node.destroy();
      }
    }

    refreshAgentMarkerCollections() {
      this.agentMarkers = Array.from(this.agentMarkerMap.values());
      this.lastRenderedAgentIds = this.agentMarkers.map((marker) => marker?.__agentId || "").filter(Boolean);
      this.lastRenderedAgents = this.agentMarkers.map((marker) => ({
        id: marker?.__agentId || "",
        zone: marker?.__agentZone || "",
        x: marker?.x ?? null,
        y: marker?.y ?? null,
        isTownView: Boolean(marker?.__isTownView),
        focused: Boolean(marker?.__isFocused),
      }));
    }

    getFocusedMarker() {
      return this.focusedMarkerId ? this.agentMarkerMap.get(this.focusedMarkerId) || null : null;
    }

    syncRobotProxyVisibility() {
      const hideProxy = Boolean(this.getFocusedMarker());
      this.player.setAlpha(hideProxy ? 0 : 1);
      this.shadow.setAlpha(hideProxy ? 0 : 1);
      this.nameplate.setVisible(!hideProxy && this.player.visible);
    }

    getAgentAccent(zone) {
      if (zone === "alarm") {
        return "#ff9a7d";
      }

      if (zone === "work") {
        return "#7bc8ff";
      }

      return "#f1a14d";
    }

    getTownAgentMarkerPosition(agent, slotIndex = 0) {
      const explicit = agent?.mapPosition || agent?.position;
      if (
        explicit
        && Number.isFinite(explicit.x)
        && Number.isFinite(explicit.y)
      ) {
        return explicit;
      }

      const zone = agent?.zone || "rest";
      const slots = TOWN_AGENT_SLOTS[zone] || TOWN_AGENT_SLOTS.rest;
      return slots[slotIndex % slots.length];
    }

    getRoomRemoteAgentPosition(agent, slotIndex = 0) {
      const remoteZone = agent?.zone || "rest";
      const slots = ROOM_REMOTE_AGENT_SLOTS[remoteZone] || ROOM_REMOTE_AGENT_SLOTS.rest;
      return slots[slotIndex % slots.length];
    }

    getRoomAgentMarkerPosition(agent, activeZone, slotIndex = 0) {
      if (agent?.zone === activeZone) {
        if (
          agent?.position
          && Number.isFinite(agent.position.x)
          && Number.isFinite(agent.position.y)
        ) {
          return agent.position;
        }
        const slots = ROOM_LOCAL_AGENT_SLOTS[activeZone] || ROOM_LOCAL_AGENT_SLOTS.work;
        return slots[slotIndex % slots.length];
      }

      return this.getRoomRemoteAgentPosition(agent, slotIndex);
    }

    getTownRoamBounds(zone) {
      const rect = TOWN_ZONE_RECTS[zone] || TOWN_ZONE_RECTS.rest;
      return {
        minX: rect.x + 0.8,
        maxX: rect.x + rect.width - 0.8,
        minY: rect.y + 0.9,
        maxY: rect.y + rect.height - 0.9,
      };
    }

    getRoomRoamBounds(zone) {
      return ROOM_AGENT_ROAM_BOUNDS[zone] || ROOM_AGENT_ROAM_BOUNDS.rest;
    }

    getRandomRoamPoint(bounds, currentPoint = null, fallbackPoint = null) {
      if (!bounds) {
        return fallbackPoint ? { ...fallbackPoint } : null;
      }

      const minDistance = 0.32;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const point = {
          x: Phaser.Math.FloatBetween(bounds.minX, bounds.maxX),
          y: Phaser.Math.FloatBetween(bounds.minY, bounds.maxY),
        };
        if (!currentPoint) {
          return point;
        }
        if (Math.abs(point.x - currentPoint.x) >= minDistance || Math.abs(point.y - currentPoint.y) >= minDistance) {
          return point;
        }
      }

      return fallbackPoint ? { ...fallbackPoint } : {
        x: bounds.minX,
        y: bounds.minY,
      };
    }

    getWorldTilePosition(worldX, worldY, isTownView) {
      if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) {
        return null;
      }

      if (isTownView) {
        return {
          x: clamp((worldX / TILE_SIZE) - 0.5, 0, TOWN_TILES - 1),
          y: clamp((worldY / TILE_SIZE) - 1, 0, TOWN_TILES - 1),
        };
      }

      return {
        x: clamp((worldX / ROOM_TILE_SIZE) - 0.5, 0, ROOM_TILES_W - 1),
        y: clamp((worldY / ROOM_TILE_SIZE) - 1, 0, ROOM_TILES_H - 1),
      };
    }

    rememberAgentTilePosition(agentId, zone, position, isTownView) {
      if (!agentId || !position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
        return;
      }

      const nextRecord = this.agentPositionMemory.get(agentId) || {};
      const entry = {
        zone: zone || "",
        position: {
          x: position.x,
          y: position.y,
        },
      };

      if (isTownView) {
        nextRecord.town = entry;
      } else {
        nextRecord.room = entry;
      }

      this.agentPositionMemory.set(agentId, nextRecord);
    }

    rememberAgentWorldPosition(agentId, zone, worldX, worldY, isTownView) {
      const tilePosition = this.getWorldTilePosition(worldX, worldY, isTownView);
      if (!tilePosition) {
        return;
      }

      this.rememberAgentTilePosition(agentId, zone, tilePosition, isTownView);
    }

    getRememberedAgentPosition(agentId, zone, isTownView) {
      if (!agentId) {
        return null;
      }

      const record = this.agentPositionMemory.get(agentId);
      const entry = isTownView ? record?.town : record?.room;
      if (!entry?.position) {
        return null;
      }

      if (entry.zone && zone && entry.zone !== zone) {
        return null;
      }

      return {
        x: entry.position.x,
        y: entry.position.y,
      };
    }

    resolveFocusedAgentPosition(state, isTownView) {
      if (!state?.zone) {
        return null;
      }

      const focusedId = state?.focusedAgentId || "main";
      const rememberedPosition = this.getRememberedAgentPosition(focusedId, state.zone, isTownView);
      if (rememberedPosition) {
        return rememberedPosition;
      }

      if (isTownView) {
        return state?.focusedAgent?.mapPosition
          || state?.focusedAgent?.position
          || this.resolveOutdoorPosition(state)
          || null;
      }

      return state?.focusedAgent?.position
        || this.resolveRoomPosition(state)
        || null;
    }

    getAgentMarkerAlpha(agent, isFocused = false) {
      void isFocused;
      if (agent?.enabled === false) {
        return 0.42;
      }

      return 0.96;
    }

    createAgentMarker(agent, isTownView) {
      const shadow = this.add.ellipse(0, isTownView ? 4 : 7, isTownView ? 20 : 26, isTownView ? 8 : 10, 0x11161b, 0.4)
        .setVisible(true);
      const sprite = this.add.sprite(0, 0, "openclaw-atlas", "misa-front");
      const label = this.add.text(0, -(isTownView ? 16 : 28), agent?.id || "", squareStyle("#f7f3d6", "#7bc8ff", isTownView ? "10px" : "12px"))
        .setOrigin(0.5, 1);
      const container = this.add.container(0, 0, [shadow, sprite, label]);
      container.__agentId = agent?.id || "";
      container.__agentZone = agent?.zone || "";
      container.__agentShadow = shadow;
      container.__agentSprite = sprite;
      container.__agentLabel = label;
      container.__agentRenderKey = "";
      container.__isTownView = isTownView;
      container.__isFocused = false;
      return container;
    }

    updateAgentMarkerAppearance(container, agent, {
      isTownView,
      isFocused = false,
      labelText = agent?.id || "",
      accent = "#f1a14d",
      markerDepth = isTownView ? 87 : 94,
      spriteScale = isTownView ? 0.8 : 1.16,
      markerAlpha = 0.54,
    } = {}) {
      const shadow = container?.__agentShadow;
      const sprite = container?.__agentSprite;
      const label = container?.__agentLabel;
      if (!container || !shadow || !sprite || !label) {
        return;
      }

      shadow.setPosition(0, isTownView ? 4 : 7);
      shadow.setSize(isTownView ? 20 : 26, isTownView ? 8 : 10);
      shadow.setScale(isFocused ? 1.12 : 1);
      sprite.setScale(isFocused ? spriteScale * 1.06 : spriteScale);
      label.setPosition(0, -(isTownView ? 16 : 28));
      label.setText(labelText);
      label.setStyle(squareStyle("#f7f3d6", accent, isTownView ? "10px" : "12px"));
      label.setAlpha(isFocused ? 1 : 0.92);
      container.setDepth(isFocused ? markerDepth + 2 : markerDepth);
      container.setAlpha(markerAlpha);
      container.__agentId = agent?.id || "";
      container.__agentZone = agent?.zone || "";
      container.__isTownView = isTownView;
      container.__isFocused = isFocused;
    }

    syncFocusedMarkerToRobot(direction = this.lastDirection || "front", isWalking = false) {
      const marker = this.getFocusedMarker();
      if (!marker || !this.player.visible) {
        this.syncRobotProxyVisibility();
        return;
      }

      marker.setPosition(this.player.x, this.player.y);
      if (marker.__agentSprite) {
        if (isWalking) {
          marker.__agentSprite.play(`walk-${direction}`, true);
        } else {
          this.setAgentMarkerIdleFrame(marker.__agentSprite, direction);
        }
      }
      this.rememberAgentWorldPosition(
        marker.__agentId,
        marker.__agentZone || this.currentZone || "",
        marker.x,
        marker.y,
        Boolean(marker.__isTownView),
      );
      this.syncRobotProxyVisibility();
    }

    syncRobotProxyToFocusedMarker(alertLevel, zone, isTownView) {
      const marker = this.getFocusedMarker();
      if (!marker) {
        return false;
      }

      this.applyRobotVisual(alertLevel, zone, isTownView);
      this.player.setPosition(marker.x, marker.y);
      this.shadow.setPosition(marker.x, marker.y + (isTownView ? 4 : 8));
      this.nameplate.setPosition(marker.x, marker.y - (isTownView ? 16 : 30));
      this.player.stop();
      this.player.setFrame("misa-front");
      this.syncRobotProxyVisibility();
      return true;
    }

    getAgentRoamProfile(agent, isTownView, isRemoteAgent = false) {
      const fallback = {
        durationMs: isTownView ? 1500 : 1900,
        pauseMs: isTownView ? 520 : 760,
        offsets: isTownView
          ? [
              { x: 0, y: 0 },
              { x: 0.42, y: 0.18 },
              { x: -0.32, y: 0.24 },
              { x: 0.18, y: -0.22 },
              { x: -0.22, y: -0.14 },
            ]
          : isRemoteAgent
            ? [
                { x: 0, y: 0 },
                { x: 0.22, y: 0.08 },
                { x: -0.2, y: 0.1 },
                { x: 0.12, y: -0.12 },
              ]
            : [
                { x: 0, y: 0 },
                { x: 0.36, y: 0.18 },
                { x: -0.28, y: 0.22 },
                { x: 0.16, y: -0.18 },
                { x: -0.18, y: -0.12 },
              ],
      };
      const agentId = String(agent?.id || "").toLowerCase();
      const profiles = {
        main: {
          durationMs: isTownView ? 1380 : 1760,
          pauseMs: isTownView ? 420 : 640,
          offsets: isTownView
            ? [
                { x: 0, y: 0 },
                { x: 0.48, y: 0.12 },
                { x: -0.3, y: 0.22 },
                { x: 0.16, y: -0.18 },
                { x: -0.2, y: -0.08 },
              ]
            : isRemoteAgent
              ? [
                  { x: 0, y: 0 },
                  { x: 0.28, y: 0.06 },
                  { x: -0.22, y: 0.1 },
                  { x: 0.12, y: -0.12 },
                ]
              : [
                  { x: 0, y: 0 },
                  { x: 0.4, y: 0.16 },
                  { x: -0.24, y: 0.2 },
                  { x: 0.18, y: -0.18 },
                  { x: -0.18, y: -0.08 },
                ],
        },
        executor: {
          durationMs: isTownView ? 920 : 1260,
          pauseMs: isTownView ? 260 : 420,
          offsets: isTownView
            ? [
                { x: 0, y: 0 },
                { x: 0.56, y: 0.1 },
                { x: -0.18, y: 0.12 },
                { x: 0.34, y: -0.1 },
                { x: -0.12, y: -0.06 },
              ]
            : isRemoteAgent
              ? [
                  { x: 0, y: 0 },
                  { x: 0.32, y: 0.04 },
                  { x: -0.16, y: 0.06 },
                  { x: 0.18, y: -0.08 },
                ]
              : [
                  { x: 0, y: 0 },
                  { x: 0.44, y: 0.14 },
                  { x: -0.18, y: 0.12 },
                  { x: 0.24, y: -0.14 },
                ],
        },
        research: {
          durationMs: isTownView ? 1980 : 2360,
          pauseMs: isTownView ? 760 : 980,
          offsets: isTownView
            ? [
                { x: 0, y: 0 },
                { x: 0.26, y: 0.32 },
                { x: -0.36, y: 0.28 },
                { x: 0.18, y: -0.28 },
                { x: -0.14, y: -0.22 },
              ]
            : isRemoteAgent
              ? [
                  { x: 0, y: 0 },
                  { x: 0.18, y: 0.12 },
                  { x: -0.16, y: 0.14 },
                  { x: 0.08, y: -0.16 },
                ]
              : [
                  { x: 0, y: 0 },
                  { x: 0.22, y: 0.3 },
                  { x: -0.3, y: 0.24 },
                  { x: 0.16, y: -0.24 },
                  { x: -0.12, y: -0.18 },
                ],
        },
        ops: {
          durationMs: isTownView ? 1640 : 2100,
          pauseMs: isTownView ? 620 : 860,
          offsets: isTownView
            ? [
                { x: 0, y: 0 },
                { x: 0.52, y: 0.18 },
                { x: -0.42, y: 0.18 },
                { x: 0.24, y: -0.18 },
                { x: -0.24, y: -0.18 },
              ]
            : isRemoteAgent
              ? [
                  { x: 0, y: 0 },
                  { x: 0.34, y: 0.08 },
                  { x: -0.3, y: 0.08 },
                  { x: 0.14, y: -0.1 },
                ]
              : [
                  { x: 0, y: 0 },
                  { x: 0.42, y: 0.18 },
                  { x: -0.34, y: 0.2 },
                  { x: 0.2, y: -0.16 },
                  { x: -0.2, y: -0.16 },
                ],
        },
      };

      return profiles[agentId] || fallback;
    }

    setAgentMarkerIdleFrame(sprite, direction = "front") {
      const idleFrame = {
        left: "misa-left",
        right: "misa-right",
        back: "misa-back",
        front: "misa-front",
      }[direction] || "misa-front";
      sprite.stop();
      sprite.setFrame(idleFrame);
    }

    startAgentMarkerRoam(container, sprite, spawnPoint, roamBounds, roamProfile, isTownView) {
      if (!container || !sprite || !spawnPoint || !roamBounds) {
        return;
      }

      const durationMs = Math.max(Number(roamProfile?.durationMs) || 1500, 320);
      const pauseMs = Math.max(Number(roamProfile?.pauseMs) || 520, 120);
      const scheduleNext = () => {
        if (!container.scene) {
          return;
        }

        const currentPoint = this.getWorldTilePosition(container.x, container.y, isTownView) || spawnPoint;
        const point = this.getRandomRoamPoint(roamBounds, currentPoint, spawnPoint);
        if (!point) {
          return;
        }
        const { x, y } = this.getWorldPosition(point, isTownView);
        const dx = x - container.x;
        const dy = y - container.y;
        const direction = Math.abs(dx) > Math.abs(dy)
          ? (dx >= 0 ? "right" : "left")
          : (dy >= 0 ? "front" : "back");

        sprite.play(`walk-${direction}`, true);
        container.__agentTween = this.tweens.add({
          targets: container,
          x,
          y,
          duration: durationMs,
          ease: "Sine.InOut",
          onUpdate: () => {
            this.rememberAgentWorldPosition(
              container.__agentId,
              container.__agentZone || "",
              container.x,
              container.y,
              isTownView,
            );
          },
          onComplete: () => {
            this.rememberAgentWorldPosition(
              container.__agentId,
              container.__agentZone || "",
              container.x,
              container.y,
              isTownView,
            );
            this.setAgentMarkerIdleFrame(sprite, direction);
            if (!container.scene) {
              return;
            }
            container.__agentTimer = this.time.delayedCall(pauseMs, scheduleNext);
          },
          onStop: () => {
            this.setAgentMarkerIdleFrame(sprite, direction);
          },
        });
      };

      container.__agentTimer = this.time.delayedCall(Math.max(Math.round(pauseMs * 0.6), 180), scheduleNext);
    }

    renderAgentMarkers(state = null) {
      const agents = Array.isArray(state?.openclaw?.agents)
        ? state.openclaw.agents.filter(Boolean)
        : [];

      if (agents.length === 0) {
        this.clearAgentMarkers();
        this.nameplate.setText(state?.focusedAgentId || "main");
        this.syncRobotProxyVisibility();
        return;
      }

      const focusedId = state?.focusedAgentId || "main";
      const focusedAgent = agents.find((agent) => agent.id === focusedId) || agents[0] || null;
      const isTownView = this.currentView === "town";
      const activeZone = state?.zone || this.currentZone || focusedAgent?.zone || "rest";
      const visibleAgents = isTownView
        ? agents
        : agents.filter((agent) => (agent?.zone || "rest") === activeZone);
      const zoneSlots = new Map();
      const nextIds = new Set();

      this.nameplate.setText(focusedAgent?.id || focusedId);
      this.focusedMarkerId = focusedAgent?.id || "";

      visibleAgents.forEach((agent) => {
          const isFocused = Boolean(focusedAgent) && agent.id === focusedAgent.id;
          const slotKey = isTownView
            ? (agent.zone || "rest")
            : agent.zone === activeZone
              ? `room:${activeZone}`
              : `room:remote:${agent.zone || "rest"}`;
          const slotIndex = zoneSlots.get(slotKey) || 0;
          zoneSlots.set(slotKey, slotIndex + 1);

          const rememberedPosition = this.getRememberedAgentPosition(
            agent.id,
            agent.zone || activeZone,
            isTownView,
          );
          const fallbackPosition = isTownView
            ? this.getTownAgentMarkerPosition(agent, slotIndex)
            : this.getRoomAgentMarkerPosition(agent, activeZone, slotIndex);

          const tilePosition = isFocused
            ? (
              rememberedPosition
              || (
                isTownView
                  ? (state?.focusedAgent?.mapPosition || state?.focusedAgent?.position)
                  : state?.focusedAgent?.position
              )
              || fallbackPosition
            )
            : (
              rememberedPosition || fallbackPosition
            );
          const isRemoteAgent = !isTownView && agent.zone !== activeZone;
          const roamProfile = this.getAgentRoamProfile(agent, isTownView, isRemoteAgent);
          const roamBounds = isTownView
            ? this.getTownRoamBounds(agent.zone || activeZone)
            : this.getRoomRoamBounds(activeZone);
          const spawnPoint = tilePosition;
          const { x, y } = this.getWorldPosition(spawnPoint, isTownView);
          const accent = this.getAgentAccent(agent.zone);
          const markerDepth = isTownView ? 87 : 94;
          const spriteScale = isTownView ? 0.8 : 1.16;
          const markerAlpha = this.getAgentMarkerAlpha(agent, isFocused);
          const labelText = isFocused
            ? `${agent.id} · 当前`
            : !isTownView && agent.zone !== activeZone
            ? `${agent.id} @${agent.zone || "rest"}`
            : agent.id;
          const renderKey = [
            isTownView ? "town" : "room",
            activeZone,
            agent.id,
            agent.zone || "",
            isFocused ? "focused" : "marker",
            Number(tilePosition?.x ?? 0).toFixed(2),
            Number(tilePosition?.y ?? 0).toFixed(2),
            labelText,
          ].join("|");
          let container = this.agentMarkerMap.get(agent.id) || null;

          if (!container) {
            container = this.createAgentMarker(agent, isTownView);
            this.agentMarkerMap.set(agent.id, container);
          }

          this.updateAgentMarkerAppearance(container, agent, {
            isTownView,
            isFocused,
            labelText,
            accent,
            markerDepth,
            spriteScale,
            markerAlpha,
          });

          if (container.__renderKey !== renderKey) {
            this.stopAgentMarkerMotion(container);
            container.setPosition(x, y);
            this.rememberAgentTilePosition(agent.id, agent.zone || activeZone, spawnPoint, isTownView);
            this.setAgentMarkerIdleFrame(container.__agentSprite);
            this.startAgentMarkerRoam(container, container.__agentSprite, spawnPoint, roamBounds, roamProfile, isTownView);
            container.__renderKey = renderKey;
          }

          nextIds.add(agent.id);
        });

      Array.from(this.agentMarkerMap.entries()).forEach(([agentId, marker]) => {
        if (nextIds.has(agentId)) {
          return;
        }

        this.destroyAgentMarker(marker);
        this.agentMarkerMap.delete(agentId);
      });

      this.refreshAgentMarkerCollections();
      this.syncRobotProxyVisibility();
    }

    applyFocusedStateImmediately(state) {
      if (!state?.zone) {
        this.clearRobot();
        return;
      }

      this.clearPreviewTimer();
      this.previewZone = state.zone;
      this.previewKey = this.getPreviewKey(state);

      if (this.isOutdoorState(state)) {
        this.buildTownView(state.zone);
        this.updateViewState(state.zone, state.alertLevel || "OFFLINE");
        this.renderAgentMarkers(state);
        const outdoorPosition = this.resolveFocusedAgentPosition(state, true)
          || this.resolveOutdoorPosition(state)
          || this.getOutdoorRoute(state)[0]
          || this.getTownDoorWalkTarget(state.zone);
        if (outdoorPosition) {
          this.teleportRobot(outdoorPosition, state.alertLevel, state.zone, true);
        } else {
          this.clearRobot();
        }
        return;
      }

      this.buildRoomView(state.zone);
      this.updateViewState(state.zone, state.alertLevel || "OFFLINE");
      this.renderAgentMarkers(state);
      if (this.syncRobotProxyToFocusedMarker(state.alertLevel, state.zone, false)) {
        return;
      }
      const roomPosition = this.resolveFocusedAgentPosition(state, false)
        || this.getRoomEntryTile(state.zone);
      if (roomPosition) {
        this.teleportRobot(roomPosition, state.alertLevel, state.zone, false);
      } else {
        this.clearRobot();
      }
    }

    clearPreviewTimer() {
      this.sequenceId += 1;
      if (this.previewTimer) {
        const timer = this.previewTimer;
        this.previewTimer = null;
        timer.remove(false);
        if (typeof timer.__resolve === "function") {
          timer.__resolve(false);
          timer.__resolve = null;
        }
      }
      if (this.moveTween) {
        const tween = this.moveTween;
        this.moveTween = null;
        tween.stop();
      }
      this.previewZone = "";
      this.previewKey = "";
      this.transitioningRoomZone = "";
      this.doorEffect.clear();
      this.hideTransitionBanner();
    }

    showTransitionBanner(zone, message) {
      const theme = ROOM_THEMES[zone] || ROOM_THEMES.work;
      this.transitionPanel.setStrokeStyle(4, theme.shadow === ROOM_THEMES.alarm.shadow ? 0xff8d68 : theme.plaqueStroke === "#f1a14d" ? 0xf1a14d : 0x7bc8ff, 0.92);
      this.transitionPanel.setVisible(true);
      this.transitionPanel.alpha = 1;
      this.transitionText.setText(message || `室外总览 -> 进入${theme.title}`);
      this.transitionText.setVisible(true);
      this.transitionText.alpha = 1;
    }

    hideTransitionBanner() {
      this.transitionPanel.setVisible(false);
      this.transitionText.setVisible(false);
    }

    waitForStep(ms, sequenceId) {
      return new Promise((resolve) => {
        const timer = this.time.delayedCall(ms, () => {
          if (this.previewTimer === timer) {
            this.previewTimer = null;
          }
          const finish = timer.__resolve;
          timer.__resolve = null;
          if (typeof finish === "function") {
            finish(this.sequenceId === sequenceId);
          }
        });
        timer.__resolve = resolve;
        this.previewTimer = timer;
      });
    }

    isOutdoorState(state) {
      return state?.scene === "outdoor";
    }

    getPreviewKey(state) {
      if (!state?.zone) {
        return "";
      }

      if (this.isOutdoorState(state)) {
        return `outdoor:${state.zone}:${state.idleActivity || "walk"}`;
      }

      return `preview:${state.zone}`;
    }

    getTownPatrolRoute(zone) {
      return TOWN_PATROL_ROUTES[zone] || TOWN_PATROL_ROUTES.work;
    }

    getOutdoorRoute(state) {
      const activity = state?.idleActivity || "walk";
      return OUTDOOR_ACTIVITY_ROUTES[activity] || OUTDOOR_ACTIVITY_ROUTES.walk;
    }

    getTownDoor(zone) {
      return TOWN_ZONE_DOORS[zone] || TOWN_ZONE_DOORS.work;
    }

    getTownDoorWalkTarget(zone) {
      const door = this.getTownDoor(zone);
      return door.walkTo || door;
    }

    getTownDoorAnchor(zone) {
      const door = this.getTownDoor(zone);
      return door.anchor || door.walkTo || door;
    }

    getCurrentTownTilePosition() {
      if (this.currentView !== "town" || !this.player?.visible) {
        return null;
      }

      return {
        x: clamp(Math.round((this.player.x / TILE_SIZE) - 0.5), 0, TOWN_TILES - 1),
        y: clamp(Math.round((this.player.y / TILE_SIZE) - 1), 0, TOWN_TILES - 1),
      };
    }

    getRoomEntryTile(zone) {
      return ROOM_ENTRY_TILES[zone] || ROOM_ENTRY_TILES.work;
    }

    resolveTownPosition(state) {
      if (!state) {
        return null;
      }

      const source = state.townPosition || state.position;
      const bounds = TOWN_PREVIEW_BOUNDS[state.zone] || TOWN_PREVIEW_BOUNDS.work;
      return projectIntoBounds(source, bounds, STATUS_MAP_WIDTH, STATUS_MAP_HEIGHT);
    }

    resolveOutdoorPosition(state) {
      if (!state) {
        return null;
      }

      const source = state.townPosition || state.position;
      const zone = state.zone || "rest";
      const bounds = TOWN_PREVIEW_BOUNDS[zone] || TOWN_PREVIEW_BOUNDS.rest;
      return projectIntoBounds(source, bounds, STATUS_MAP_WIDTH, STATUS_MAP_HEIGHT);
    }

    resolveRoomPosition(state) {
      if (!state) {
        return null;
      }

      return state.roomPosition || state.position || null;
    }

    getOutdoorBanner(state) {
      return `室外放风 · ${state?.idleActivityLabel || "外出散步"}`;
    }

    drawTownDoorOpen(zone, openness = 1) {
      const door = this.getTownDoorAnchor(zone);
      if (!door) {
        return;
      }

      const x = tileToWorldX(door.x);
      const y = tileToWorldY(door.y) + 2;
      const width = 16 + (18 * openness);

      this.doorEffect.clear();
      this.doorEffect.fillStyle(0xffd166, 0.18);
      this.doorEffect.fillEllipse(x, y + 2, width + 16, 16);
      this.doorEffect.fillStyle(0x10161b, 0.92);
      this.doorEffect.fillRect(x - (width / 2), y - 10, width, 16);
      this.doorEffect.lineStyle(2, 0xe7d59b, 0.92);
      this.doorEffect.strokeRect(x - (width / 2), y - 10, width, 16);
      this.doorEffect.fillStyle(0xf3e2b6, 0.92);
      this.doorEffect.fillRect(x - (width / 2), y - 12, width, 3);
      this.doorEffect.fillStyle(0xf6bf53, 0.72);
      this.doorEffect.fillRect(x - ((width / 2) + 4), y - 6, 3, 10);
      this.doorEffect.fillRect(x + ((width / 2) + 1), y - 6, 3, 10);
    }

    async animateDoorOpen(zone, sequenceId) {
      this.drawTownDoorOpen(zone, 0.4);
      if (!(await this.waitForStep(80, sequenceId))) {
        return false;
      }

      this.drawTownDoorOpen(zone, 0.8);
      if (!(await this.waitForStep(90, sequenceId))) {
        return false;
      }

      this.drawTownDoorOpen(zone, 1);
      if (!(await this.waitForStep(DOOR_OPEN_MS, sequenceId))) {
        return false;
      }

      this.doorEffect.clear();
      return true;
    }

    getWorldPosition(position, isTownView = this.currentView === "town") {
      return {
        x: isTownView ? tileToWorldX(position.x) : roomTileToWorldX(position.x),
        y: isTownView ? tileToWorldY(position.y) : roomTileToWorldY(position.y),
      };
    }

    applyRobotVisual(alertLevel, zone, isTownView) {
      const shadowColor = isTownView ? 0x11161b : ROOM_THEMES[zone]?.shadow || 0x11161b;

      this.player.setVisible(true);
      this.shadow.setVisible(true);
      this.nameplate.setVisible(true);
      this.shadow.setFillStyle(shadowColor, alertLevel === "RED" ? 0.45 : 0.34);
      this.player.setScale(isTownView ? 1 : 1.7);
      this.shadow.setScale(isTownView ? 1 : 1.5);
      this.nameplate.setScale(isTownView ? 1 : 1.12);
      this.syncRobotProxyVisibility();
    }

    teleportRobot(position, alertLevel, zone, isTownView = this.currentView === "town") {
      const { x, y } = this.getWorldPosition(position, isTownView);

      this.applyRobotVisual(alertLevel, zone, isTownView);
      this.player.setPosition(x, y);
      this.shadow.setPosition(x, y + (isTownView ? 4 : 8));
      this.nameplate.setPosition(x, y - (isTownView ? 16 : 30));
      this.player.stop();
      this.player.setFrame("misa-front");
      this.syncFocusedMarkerToRobot("front", false);
    }

    moveRobotTo(position, alertLevel, zone, duration = 280, isTownView = this.currentView === "town") {
      return new Promise((resolve) => {
        const { x, y } = this.getWorldPosition(position, isTownView);
        const hasVisibleRobot = this.player.visible;
        const previousX = this.player.x || x;
        const previousY = this.player.y || y;
        let settled = false;

        const finish = (result, direction) => {
          if (settled) {
            return;
          }

          settled = true;
          this.moveTween = null;

          const idleFrame = {
            left: "misa-left",
            right: "misa-right",
            back: "misa-back",
            front: "misa-front",
          }[direction] || "misa-front";

          this.player.stop();
          this.player.setFrame(idleFrame);
          this.nameplate.setPosition(this.player.x, this.player.y - (isTownView ? 16 : 30));
          this.syncFocusedMarkerToRobot(direction, false);
          resolve(result);
        };

        this.applyRobotVisual(alertLevel, zone, isTownView);

        if (!hasVisibleRobot) {
          this.teleportRobot(position, alertLevel, zone, isTownView);
          finish(true, "front");
          return;
        }

        if (Math.abs(previousX - x) < 1 && Math.abs(previousY - y) < 1) {
          finish(true, this.lastDirection || "front");
          return;
        }

        const dx = x - previousX;
        const dy = y - previousY;
        const direction = Math.abs(dx) > Math.abs(dy)
          ? (dx >= 0 ? "right" : "left")
          : (dy >= 0 ? "front" : "back");

        this.lastDirection = direction;
        this.player.play(`walk-${direction}`, true);

        if (this.moveTween) {
          this.moveTween.stop();
        }

        this.moveTween = this.tweens.add({
          targets: [this.player, this.shadow],
          x,
          y: (target) => target === this.shadow ? y + (isTownView ? 4 : 8) : y,
          duration,
          ease: "Quad.Out",
          onUpdate: () => {
            this.nameplate.setPosition(this.player.x, this.player.y - (isTownView ? 16 : 30));
            this.syncFocusedMarkerToRobot(direction, true);
          },
          onComplete: () => {
            finish(true, direction);
          },
          onStop: () => {
            finish(false, direction);
          },
        });
      });
    }

    async startOutdoorPatrol(state) {
      const zone = state?.zone || "rest";
      this.clearPreviewTimer();
      const sequenceId = this.sequenceId;
      this.previewZone = zone;
      this.previewKey = this.getPreviewKey(state);
      this.transitioningRoomZone = "";
      this.buildTownView(zone);
      this.updateViewState(zone, state?.alertLevel || "OFFLINE");
      this.renderAgentMarkers(state);

      await this.runOutdoorPatrolLoop(state, sequenceId, {
        startPoint: this.resolveOutdoorPosition(state) || this.getOutdoorRoute(state)[0] || this.getTownDoorWalkTarget(zone),
      });
    }

    async runOutdoorPatrolLoop(state, sequenceId, options = {}) {
      const zone = state?.zone || "rest";
      const route = this.getOutdoorRoute(state);
      const fallbackRoutePoint = this.resolveOutdoorPosition(state) || route[0] || this.getTownDoorWalkTarget(zone);
      const startPoint = options.startPoint || fallbackRoutePoint;

      if (!startPoint) {
        this.clearRobot();
        return;
      }

      this.showTransitionBanner(zone, this.getOutdoorBanner(state));
      if (options.teleport === false) {
        const moved = await this.moveRobotTo(startPoint, state.alertLevel, zone, OUTDOOR_PATROL_STEP_MS, true);
        if (!moved || this.sequenceId !== sequenceId) {
          return;
        }
      } else {
        this.teleportRobot(startPoint, state.alertLevel, zone, true);
      }

      const routeStartPoint = options.routeStartPoint || fallbackRoutePoint;
      if (routeStartPoint && !sameTilePosition(startPoint, routeStartPoint)) {
        const movedToRoute = await this.moveRobotTo(routeStartPoint, state.alertLevel, zone, OUTDOOR_PATROL_STEP_MS, true);
        if (!movedToRoute || this.sequenceId !== sequenceId) {
          return;
        }
      }

      if (route.length === 0) {
        return;
      }

      let cursor = 0;
      if (routeStartPoint) {
        const matchedIndex = route.findIndex((point) => sameTilePosition(point, routeStartPoint));
        if (matchedIndex >= 0) {
          cursor = (matchedIndex + 1) % route.length;
        }
      }

      while (this.sequenceId === sequenceId) {
        const latestState = pendingState;
        if (!latestState || !this.isOutdoorState(latestState) || latestState.zone !== zone) {
          return;
        }

        this.renderAgentMarkers(latestState);

        const target = route[cursor];
        cursor = (cursor + 1) % route.length;

        const moved = await this.moveRobotTo(target, latestState.alertLevel, zone, OUTDOOR_PATROL_STEP_MS, true);
        if (!moved || this.sequenceId !== sequenceId) {
          return;
        }

        if (!(await this.waitForStep(OUTDOOR_IDLE_PAUSE_MS, sequenceId)) || this.sequenceId !== sequenceId) {
          return;
        }

        this.showTransitionBanner(zone, this.getOutdoorBanner(pendingState || latestState));
      }
    }

    async startOutdoorExit(state) {
      const targetZone = state?.zone || this.currentZone || "rest";
      const exitZone = this.currentZone || targetZone;

      if (!this.currentView.endsWith("-room")) {
        this.startOutdoorPatrol(state);
        return;
      }

      this.clearPreviewTimer();
      const sequenceId = this.sequenceId;
      this.previewZone = targetZone;
      this.previewKey = this.getPreviewKey(state);
      this.transitioningRoomZone = exitZone;
      this.updateViewState(exitZone, state?.alertLevel || "OFFLINE");
      this.showTransitionBanner(exitZone, `离开${ROOM_THEMES[exitZone]?.title || exitZone}`);

      const roomDoor = this.getRoomEntryTile(exitZone);
      const reachedDoor = await this.moveRobotTo(roomDoor, state.alertLevel, exitZone, 420, false);
      if (!reachedDoor || this.sequenceId !== sequenceId) {
        return;
      }

      if (!(await this.waitForStep(INDOOR_SETTLE_MS, sequenceId)) || this.sequenceId !== sequenceId) {
        return;
      }

      this.showTransitionBanner(exitZone, `推门离开${ROOM_THEMES[exitZone]?.title || exitZone}`);
      this.buildTownView(targetZone);
      this.updateViewState(targetZone, state?.alertLevel || "OFFLINE");
      this.renderAgentMarkers(state);
      this.transitioningRoomZone = "";

      const outdoorDoorPoint = this.getTownDoorWalkTarget(exitZone);
      this.teleportRobot(outdoorDoorPoint, state.alertLevel, targetZone, true);

      if (!(await this.waitForStep(INDOOR_SETTLE_MS, sequenceId)) || this.sequenceId !== sequenceId) {
        return;
      }

      const latestState = pendingState;
      if (!latestState || !this.isOutdoorState(latestState)) {
        if (latestState?.zone) {
          this.startZonePreview(latestState);
        }
        return;
      }

      const routeStartPoint = this.resolveOutdoorPosition(latestState) || this.getOutdoorRoute(latestState)[0] || outdoorDoorPoint;
      await this.runOutdoorPatrolLoop(latestState, sequenceId, {
        startPoint: outdoorDoorPoint,
        routeStartPoint,
      });
    }

    async startZonePreview(state) {
      const zone = state?.zone;
      if (!zone) {
        return;
      }

      if (this.isOutdoorState(state)) {
        this.startOutdoorPatrol(state);
        return;
      }

      this.clearPreviewTimer();
      const sequenceId = this.sequenceId;
      this.previewZone = zone;
      this.previewKey = this.getPreviewKey(state);
      this.transitioningRoomZone = zone;
      const currentTownPoint = this.getCurrentTownTilePosition();
      this.buildTownView(zone);
      this.updateViewState(zone, state.alertLevel || "OFFLINE");
      this.renderAgentMarkers(state);

      const route = this.getTownPatrolRoute(zone);
      const startPoint = currentTownPoint || route[0];
      if (route.length === 0) {
        this.clearRobot();
        return;
      }

      this.showTransitionBanner(zone, `室外总览 · 前往${ROOM_THEMES[zone]?.title || zone}`);
      this.teleportRobot(startPoint, state.alertLevel, zone, true);

      const routeStartIndex = route.findIndex((point) => sameTilePosition(point, startPoint));
      if (routeStartIndex === -1 && route[0] && !sameTilePosition(route[0], startPoint)) {
        await this.moveRobotTo(route[0], state.alertLevel, zone, OUTDOOR_PATROL_STEP_MS, true);
      }

      for (let index = Math.max(routeStartIndex + 1, 1); index < route.length; index += 1) {
        if (this.sequenceId !== sequenceId) {
          return;
        }
        await this.moveRobotTo(route[index], state.alertLevel, zone, OUTDOOR_PATROL_STEP_MS, true);
      }

      if (this.sequenceId !== sequenceId) {
        return;
      }

      const door = this.getTownDoorWalkTarget(zone);
      await this.moveRobotTo(door, state.alertLevel, zone, OUTDOOR_PATROL_STEP_MS, true);
      if (this.sequenceId !== sequenceId) {
        return;
      }

      this.showTransitionBanner(zone, `开门进入${ROOM_THEMES[zone]?.title || zone}`);
      const doorOpened = await this.animateDoorOpen(zone, sequenceId);
      if (!doorOpened || this.sequenceId !== sequenceId) {
        return;
      }

      const latestState = pendingState;
      if (!latestState || latestState.zone !== zone) {
        this.transitioningRoomZone = "";
        this.hideTransitionBanner();
        return;
      }

      if (this.isOutdoorState(latestState)) {
        this.transitioningRoomZone = "";
        this.startOutdoorPatrol(latestState);
        return;
      }

      this.enterRoom(latestState, sequenceId);
    }

    async startZoneTransfer(state) {
      const targetZone = state?.zone;
      const sourceZone = this.currentZone || targetZone;
      if (!targetZone || !sourceZone || sourceZone === targetZone || !this.currentView.endsWith("-room")) {
        this.startZonePreview(state);
        return;
      }

      this.clearPreviewTimer();
      const sequenceId = this.sequenceId;
      this.previewZone = targetZone;
      this.previewKey = this.getPreviewKey(state);
      this.transitioningRoomZone = targetZone;
      this.updateViewState(sourceZone, state.alertLevel || "OFFLINE");
      this.showTransitionBanner(sourceZone, `离开${ROOM_THEMES[sourceZone]?.title || sourceZone}`);

      const sourceRoomDoor = this.getRoomEntryTile(sourceZone);
      const reachedDoor = await this.moveRobotTo(sourceRoomDoor, state.alertLevel, sourceZone, 420, false);
      if (!reachedDoor || this.sequenceId !== sequenceId) {
        return;
      }

      if (!(await this.waitForStep(INDOOR_SETTLE_MS, sequenceId)) || this.sequenceId !== sequenceId) {
        return;
      }

      this.buildTownView(targetZone);
      this.updateViewState(targetZone, state.alertLevel || "OFFLINE");
      this.renderAgentMarkers(state);
      const sourceOutdoorDoor = this.getTownDoorWalkTarget(sourceZone);
      this.teleportRobot(sourceOutdoorDoor, state.alertLevel, targetZone, true);

      if (!(await this.waitForStep(INDOOR_SETTLE_MS, sequenceId)) || this.sequenceId !== sequenceId) {
        return;
      }

      this.showTransitionBanner(targetZone, `前往${ROOM_THEMES[targetZone]?.title || targetZone}`);
      const targetOutdoorDoor = this.getTownDoorWalkTarget(targetZone);
      if (!sameTilePosition(sourceOutdoorDoor, targetOutdoorDoor)) {
        const moved = await this.moveRobotTo(targetOutdoorDoor, state.alertLevel, targetZone, OUTDOOR_PATROL_STEP_MS * 2, true);
        if (!moved || this.sequenceId !== sequenceId) {
          return;
        }
      }

      this.showTransitionBanner(targetZone, `开门进入${ROOM_THEMES[targetZone]?.title || targetZone}`);
      const doorOpened = await this.animateDoorOpen(targetZone, sequenceId);
      if (!doorOpened || this.sequenceId !== sequenceId) {
        return;
      }

      const latestState = pendingState;
      if (!latestState) {
        this.transitioningRoomZone = "";
        this.hideTransitionBanner();
        return;
      }

      if (this.isOutdoorState(latestState)) {
        this.transitioningRoomZone = "";
        this.startOutdoorPatrol(latestState);
        return;
      }

      if (latestState.zone !== targetZone) {
        this.transitioningRoomZone = "";
        this.startZonePreview(latestState);
        return;
      }

      this.enterRoom(latestState, sequenceId);
    }

    async enterRoom(state, sequenceId = this.sequenceId) {
      const zone = state?.zone;
      if (!zone) {
        return;
      }

      const latestState = pendingState;

      if (!latestState || latestState.zone !== zone || this.isOutdoorState(latestState)) {
        this.transitioningRoomZone = "";
        this.hideTransitionBanner();
        if (latestState?.zone && this.isOutdoorState(latestState)) {
          this.startOutdoorPatrol(latestState);
        } else if (latestState?.zone) {
          this.startZonePreview(latestState);
        } else {
          this.buildTownView("");
          this.clearRobot();
        }
        return;
      }

      this.buildRoomView(zone);
      this.updateViewState(zone, latestState.alertLevel || "OFFLINE");
      this.renderAgentMarkers(latestState);
      this.showTransitionBanner(zone, `${ROOM_THEMES[zone]?.title || zone} · 就位中`);

      const entryTile = this.getRoomEntryTile(zone);
      this.teleportRobot(entryTile, latestState.alertLevel, zone, false);

      if (!(await this.waitForStep(INDOOR_SETTLE_MS, sequenceId)) || this.sequenceId !== sequenceId) {
        return;
      }

      const roomPosition = this.resolveFocusedAgentPosition(pendingState || latestState, false);
      if (roomPosition) {
        await this.moveRobotTo(roomPosition, latestState.alertLevel, zone, 460, false);
      } else {
        this.clearRobot();
      }

      if (this.sequenceId !== sequenceId) {
        return;
      }

      this.transitioningRoomZone = "";
      this.previewZone = "";
      this.previewKey = "";
      this.hideTransitionBanner();
    }

    destroyCurrentView() {
      this.currentObjects.forEach((object) => object.destroy());
      this.currentObjects = [];
      this.alertLightGraphics.clear();
      this.roomGlow.clear();
      this.roomGlow.setVisible(false);
    }

    buildTownView(activeZone = "") {
      this.destroyCurrentView();
      this.currentView = "town";
      this.currentZone = activeZone || "";

      const map = this.cache.tilemap.exists("openclaw-town")
        ? this.make.tilemap({ key: "openclaw-town" })
        : null;
      const tileset = map
        ? map.addTilesetImage("tuxemon-sample-32px-extruded", "openclaw-tiles")
        : null;
      const townLayers = tileset
        ? [
            [map.createLayer("Below Player", tileset, 0, 0), 1],
            [map.createLayer("World", tileset, 0, 0), 2],
            [map.createLayer("Above Player", tileset, 0, 0), 60],
          ]
            .map(([layer, depth]) => (layer ? layer.setDepth(depth) : null))
            .filter(Boolean)
        : [];

      if (townLayers.length > 0) {
        this.currentObjects.push(...townLayers);
      } else {
        this.addTownFallbackBackdrop();
      }

      const zoneOverlay = this.add.graphics().setDepth(40);
      if (activeZone && TOWN_ZONE_RECTS[activeZone]) {
        const rect = TOWN_ZONE_RECTS[activeZone];
        zoneOverlay.fillStyle(rect.color, 0.08);
        zoneOverlay.fillRect(rect.x * TILE_SIZE, rect.y * TILE_SIZE, rect.width * TILE_SIZE, rect.height * TILE_SIZE);
        zoneOverlay.lineStyle(3, rect.color, 0.72);
        zoneOverlay.strokeRect(rect.x * TILE_SIZE, rect.y * TILE_SIZE, rect.width * TILE_SIZE, rect.height * TILE_SIZE);
      }
      this.currentObjects.push(zoneOverlay);

      this.drawTownAlarmHouse();

      Object.entries(TOWN_ZONE_LABELS).forEach(([zone, badge]) => {
        const label = this.add.text(
          tileToWorldX(badge.x),
          tileToWorldY(badge.y) - 18,
          badge.text,
          squareStyle(badge.fill, badge.stroke),
        )
          .setOrigin(0.5, 0.5)
          .setDepth(61)
          .setAlpha(zone === activeZone ? 1 : 0.86);
        this.currentObjects.push(label);
      });

      this.cameras.main.setBounds(0, 0, TOWN_WORLD_SIZE, TOWN_WORLD_SIZE);
      this.cameras.main.setZoom(0.82);
      this.cameras.main.centerOn(TOWN_WORLD_SIZE / 2, TOWN_WORLD_SIZE / 2);
      this.cameras.main.setRoundPixels(true);
    }

    addTownFallbackBackdrop() {
      const backdrop = this.add.rectangle(TOWN_WORLD_SIZE / 2, TOWN_WORLD_SIZE / 2, TOWN_WORLD_SIZE, TOWN_WORLD_SIZE, 0x203743, 1)
        .setDepth(1);
      const grid = this.add.graphics().setDepth(2);

      grid.lineStyle(1, 0x3c5966, 0.22);
      for (let offset = 0; offset <= TOWN_WORLD_SIZE; offset += TILE_SIZE) {
        grid.lineBetween(offset, 0, offset, TOWN_WORLD_SIZE);
        grid.lineBetween(0, offset, TOWN_WORLD_SIZE, offset);
      }

      this.currentObjects.push(backdrop, grid);
    }

    drawTownAlarmHouse() {
      const { x, y, width, height } = TOWN_ALARM_HOUSE;
      const left = x * TILE_SIZE;
      const top = y * TILE_SIZE;
      const pixelWidth = width * TILE_SIZE;
      const pixelHeight = height * TILE_SIZE;

      const shadow = this.add.graphics().setDepth(39);
      shadow.fillStyle(0x12181c, 0.22);
      shadow.fillRect(left + 16, top + pixelHeight - 6, pixelWidth - 20, 14);
      this.currentObjects.push(shadow);

      const house = this.add.graphics().setDepth(44);
      house.fillStyle(0x5b6f95, 1);
      house.fillRect(left + 4, top, pixelWidth - 8, 18);
      house.fillStyle(0x7f95bd, 1);
      house.fillRect(left + 10, top + 6, pixelWidth - 20, 22);
      house.fillStyle(0xd4d9d8, 1);
      house.fillRect(left + 12, top + 24, pixelWidth - 24, pixelHeight - 34);
      house.fillStyle(0xa7b0b5, 1);
      house.fillRect(left + 12, top + pixelHeight - 14, pixelWidth - 24, 6);

      house.fillStyle(0x8f6748, 1);
      house.fillRect(left + 62, top + pixelHeight - 44, 36, 24);
      house.fillStyle(0x1a2128, 1);
      house.fillRect(left + 68, top + pixelHeight - 38, 24, 18);
      house.fillStyle(0xf1ddb0, 1);
      house.fillRect(left + 68, top + pixelHeight - 44, 24, 4);

      house.fillStyle(0x6f4e39, 1);
      house.fillRect(left + 28, top + 34, 42, 16);
      house.fillStyle(0x9fd2ff, 1);
      house.fillRect(left + 32, top + 38, 34, 8);
      house.fillStyle(0xe3f5ff, 1);
      house.fillRect(left + 32, top + 38, 4, 8);
      house.fillStyle(0x5d7c9c, 1);
      house.fillRect(left + 47, top + 38, 4, 8);

      house.fillStyle(0x2c3641, 1);
      house.fillRect(left + 88, top + 20, 22, 12);
      house.fillStyle(0xf46f61, 1);
      house.fillRect(left + 92, top + 24, 14, 4);

      house.fillStyle(0xe9d8a8, 1);
      house.fillRect(left + 18, top + 60, pixelWidth - 36, 4);
      house.lineStyle(4, 0x394550, 1);
      house.strokeRect(left + 12, top + 24, pixelWidth - 24, pixelHeight - 34);
      this.currentObjects.push(house);
    }

    addRepeatedTexture(textureKey, x, y, width, height, depth, options = {}) {
      const sprite = this.add.tileSprite(x + (width / 2), y + (height / 2), width, height, textureKey).setOrigin(0.5).setDepth(depth);
      if (options.tileScale) {
        sprite.setTileScale(options.tileScale, options.tileScale);
      }
      this.currentObjects.push(sprite);
      return sprite;
    }

    addFrame(x, y, width, height, fill, border, depth) {
      const g = this.add.graphics().setDepth(depth);
      g.fillStyle(fill, 1);
      g.fillRect(x, y, width, height);
      g.lineStyle(4, border, 1);
      g.strokeRect(x, y, width, height);
      this.currentObjects.push(g);
      return g;
    }

    addShadow(x, y, width, height, depth, alpha = 0.18) {
      const shadow = this.add.rectangle(x, y, width, height, 0x10161a, alpha).setDepth(depth);
      this.currentObjects.push(shadow);
      return shadow;
    }

    addFurniture(textureKey, x, y, depth, options = {}) {
      const sprite = this.add.image(x, y, textureKey).setOrigin(options.originX ?? 0.5, options.originY ?? 1).setDepth(depth);
      const baseScale = options.scale ?? 1;
      const roomScale = this.currentView.endsWith("-room") ? ROOM_SCALE : 1;
      sprite.setScale(baseScale * roomScale);
      this.currentObjects.push(sprite);
      return sprite;
    }

    buildRoomView(zone) {
      this.destroyCurrentView();
      this.currentView = `${zone}-room`;
      this.currentZone = zone;

      const theme = ROOM_THEMES[zone] || ROOM_THEMES.work;
      const width = ROOM_WORLD_W;
      const height = ROOM_WORLD_H;

      this.addFrame(0, 0, width, height, 0x141920, 0x2a3440, 1);
      this.addRepeatedTexture(theme.wallTexture, 0, 0, width, ROOM_TILE_SIZE * 4, 2, { tileScale: ROOM_SCALE });
      this.addRepeatedTexture(theme.floorTexture, 0, ROOM_TILE_SIZE * 4, width, height - (ROOM_TILE_SIZE * 4), 1, { tileScale: ROOM_SCALE });
      this.addShadow(width / 2, ROOM_TILE_SIZE * 4 - 10, width - 34, 28, 5, 0.18);
      this.addShadow(width / 2, ROOM_TILE_SIZE * 4 + 12, width - 48, 24, 6, 0.22);

      this.addFurniture("room-window", ROOM_TILE_SIZE * 6, ROOM_TILE_SIZE * 2.9, 9, { originX: 0.5, originY: 0 });
      this.addFurniture("room-window", ROOM_TILE_SIZE * 14, ROOM_TILE_SIZE * 2.9, 9, { originX: 0.5, originY: 0 });
      this.addFurniture("room-door", width / 2, height - 10, 12);

      const plaque = this.add.text(width / 2, ROOM_TILE_SIZE * 2.35, theme.title, squareStyle(theme.plaqueFill, theme.plaqueStroke, "18px"))
        .setOrigin(0.5, 0.5)
        .setDepth(30);
      this.currentObjects.push(plaque);

      if (zone === "rest") {
        this.buildRestRoom(theme);
      } else if (zone === "work") {
        this.buildWorkRoom(theme);
      } else {
        this.buildAlarmRoom(theme);
      }

      this.cameras.main.setBounds(0, 0, width, height);
      this.cameras.main.setZoom(1);
      this.cameras.main.centerOn(width / 2, height / 2 + 36);
      this.cameras.main.setRoundPixels(true);
    }

    buildRestRoom(theme) {
      this.addFurniture(theme.rugTexture, ROOM_WORLD_W / 2, ROOM_TILE_SIZE * 11.85, 9, { scale: 1.06 });
      this.addFurniture("furniture-wardrobe", ROOM_TILE_SIZE * 3.2, ROOM_TILE_SIZE * 12.9, 20);
      this.addFurniture("furniture-plant", ROOM_TILE_SIZE * 5.3, ROOM_TILE_SIZE * 13.35, 21);
      this.addFurniture("furniture-nightstand", ROOM_TILE_SIZE * 8.3, ROOM_TILE_SIZE * 11.05, 20, { scale: 0.94 });
      this.addFurniture("furniture-lamp", ROOM_TILE_SIZE * 8.35, ROOM_TILE_SIZE * 10.15, 21, { scale: 0.94 });
      this.addFurniture("furniture-bed", ROOM_TILE_SIZE * 12.5, ROOM_TILE_SIZE * 13.05, 22);
      this.addFurniture("furniture-nightstand", ROOM_TILE_SIZE * 16.0, ROOM_TILE_SIZE * 11.05, 22, { scale: 0.94 });
      this.addFurniture("furniture-bookshelf", ROOM_TILE_SIZE * 17.55, ROOM_TILE_SIZE * 12.9, 21, { scale: 0.9 });
      this.addFurniture("furniture-dresser", ROOM_TILE_SIZE * 6.6, ROOM_TILE_SIZE * 15.0, 18, { scale: 0.98 });
      this.addFurniture("furniture-meeting-table", ROOM_TILE_SIZE * 15.2, ROOM_TILE_SIZE * 15.15, 18, { scale: 0.78 });
    }

    buildWorkRoom(theme) {
      this.addFurniture(theme.rugTexture, ROOM_WORLD_W / 2, ROOM_TILE_SIZE * 11.6, 9);
      this.addFurniture("furniture-desk", ROOM_WORLD_W / 2, ROOM_TILE_SIZE * 9.5, 21);
      this.addFurniture("furniture-chair", ROOM_WORLD_W / 2, ROOM_TILE_SIZE * 11.4, 22);
      this.addFurniture("furniture-bookshelf", ROOM_TILE_SIZE * 3.2, ROOM_TILE_SIZE * 12.8, 20);
      this.addFurniture("furniture-rack", ROOM_TILE_SIZE * 17.1, ROOM_TILE_SIZE * 12.8, 20);
      this.addFurniture("furniture-meeting-table", ROOM_TILE_SIZE * 7.2, ROOM_TILE_SIZE * 14.3, 18);
      this.addFurniture("furniture-plant", ROOM_TILE_SIZE * 15.5, ROOM_TILE_SIZE * 13.4, 21);
      this.addFurniture("furniture-nightstand", ROOM_TILE_SIZE * 2.8, ROOM_TILE_SIZE * 8.5, 19);
    }

    buildAlarmRoom(theme) {
      this.addFurniture(theme.rugTexture, ROOM_WORLD_W / 2, ROOM_TILE_SIZE * 11.55, 9, { scale: 1.02 });
      this.addFurniture("furniture-terminal", ROOM_TILE_SIZE * 4.1, ROOM_TILE_SIZE * 8.7, 19, { scale: 0.96 });
      this.addFurniture("furniture-terminal", ROOM_TILE_SIZE * 15.9, ROOM_TILE_SIZE * 8.7, 19, { scale: 0.96 });
      this.addFurniture("furniture-rack", ROOM_TILE_SIZE * 3.1, ROOM_TILE_SIZE * 12.95, 21);
      this.addFurniture("furniture-rack", ROOM_TILE_SIZE * 16.9, ROOM_TILE_SIZE * 12.95, 21);
      this.addFurniture("furniture-console", ROOM_WORLD_W / 2, ROOM_TILE_SIZE * 10.1, 23);
      this.addFurniture("furniture-terminal", ROOM_WORLD_W / 2, ROOM_TILE_SIZE * 14.9, 18, { scale: 1.12 });
      this.addFurniture("furniture-nightstand", ROOM_TILE_SIZE * 8.0, ROOM_TILE_SIZE * 14.95, 18, { scale: 0.88 });
      this.addFurniture("furniture-nightstand", ROOM_TILE_SIZE * 12.0, ROOM_TILE_SIZE * 14.95, 18, { scale: 0.88 });
      this.addFurniture("furniture-beacon", ROOM_TILE_SIZE * 3.0, ROOM_TILE_SIZE * 6.9, 30);
      this.addFurniture("furniture-beacon", ROOM_TILE_SIZE * 17.1, ROOM_TILE_SIZE * 6.9, 30);
      this.addShadow(ROOM_WORLD_W / 2, ROOM_TILE_SIZE * 13.8, 520, 42, 18, 0.18);
      this.roomGlow.setVisible(true);
      this.roomGlow.clear();
      this.roomGlow.fillStyle(0xff8d68, 0.06);
      this.roomGlow.fillRect(ROOM_TILE_SIZE * 4.5, ROOM_TILE_SIZE * 6.2, ROOM_TILE_SIZE * 11, ROOM_TILE_SIZE * 7.8);
      this.roomGlow.lineStyle(3, 0xff8d68, 0.62);
      this.roomGlow.strokeRect(ROOM_TILE_SIZE * 4.5, ROOM_TILE_SIZE * 6.2, ROOM_TILE_SIZE * 11, ROOM_TILE_SIZE * 7.8);
    }

    drawTownAlertLights(alertLevel = "OFFLINE") {
      const active = alertLevel === "AMBER" || alertLevel === "RED";
      const glowColor = alertLevel === "RED" ? 0xff6c5c : 0xffd166;
      this.alertLightGraphics.clear();

      TOWN_ALERT_LIGHT_TILES.forEach((light) => {
        const x = tileToWorldX(light.x);
        const y = tileToWorldY(light.y) - 26;
        this.alertLightGraphics.fillStyle(0x2c3641, 0.9);
        this.alertLightGraphics.fillCircle(x, y, 7);
        if (active) {
          this.alertLightGraphics.fillStyle(glowColor, 0.95);
          this.alertLightGraphics.fillCircle(x, y, 4);
        }
      });
    }

    drawRoomAlertLights(alertLevel = "OFFLINE") {
      const active = alertLevel === "AMBER" || alertLevel === "RED";
      const glowColor = alertLevel === "RED" ? 0xff6c5c : 0xffd166;
      this.alertLightGraphics.clear();

      if (this.currentZone !== "alarm") {
        return;
      }

      [
        { x: ROOM_TILE_SIZE * 3.05, y: ROOM_TILE_SIZE * 6.05 },
        { x: ROOM_TILE_SIZE * 16.95, y: ROOM_TILE_SIZE * 6.05 },
      ].forEach((light) => {
        this.alertLightGraphics.fillStyle(0x2c3641, 0.88);
        this.alertLightGraphics.fillCircle(light.x, light.y, 9);
        if (active) {
          this.alertLightGraphics.fillStyle(glowColor, 0.96);
          this.alertLightGraphics.fillCircle(light.x, light.y, 5);
        }
      });

      if (this.alertTween) {
        this.alertTween.stop();
        this.alertTween = null;
      }

      if (active) {
        this.alertTween = this.tweens.add({
          targets: this.alertLightGraphics,
          alpha: { from: 1, to: 0.45 },
          duration: alertLevel === "RED" ? 260 : 520,
          yoyo: true,
          repeat: -1,
        });
      } else {
        this.alertLightGraphics.alpha = 1;
      }
    }

    updateViewState(zone, alertLevel) {
      if (this.currentView === "town") {
        this.drawTownAlertLights(alertLevel);
        return;
      }

      this.drawRoomAlertLights(alertLevel);
      if (this.currentZone === "alarm") {
        const color = alertLevel === "RED" ? 0xff7262 : 0xffd166;
        this.roomGlow.clear();
        this.roomGlow.fillStyle(color, alertLevel === "OFFLINE" ? 0 : 0.06);
        this.roomGlow.fillRect(ROOM_TILE_SIZE * 4.5, ROOM_TILE_SIZE * 6.2, ROOM_TILE_SIZE * 11, ROOM_TILE_SIZE * 7.8);
        if (alertLevel === "AMBER" || alertLevel === "RED") {
          this.roomGlow.lineStyle(3, color, 0.72);
          this.roomGlow.strokeRect(ROOM_TILE_SIZE * 4.5, ROOM_TILE_SIZE * 6.2, ROOM_TILE_SIZE * 11, ROOM_TILE_SIZE * 7.8);
        }
      }
    }

    applyState(state) {
      pendingState = state;
      const nextFocusedAgentId = state?.focusedAgentId || "main";
      const focusChanged = Boolean(this.lastAppliedFocusedAgentId)
        && this.lastAppliedFocusedAgentId !== nextFocusedAgentId;
      this.lastAppliedFocusedAgentId = nextFocusedAgentId;

      if (!this.player) {
        return;
      }

      if (!state || !state.zone) {
        this.clearPreviewTimer();
        if (this.currentView !== "town") {
          this.buildTownView("");
        }
        this.updateViewState("", state?.alertLevel || "OFFLINE");
        this.clearRobot();
        return;
      }

      if (focusChanged) {
        this.applyFocusedStateImmediately(state);
        return;
      }

      if (this.isOutdoorState(state)) {
        const sameOutdoorPreview = this.currentView === "town" && this.previewKey === this.getPreviewKey(state);
        const sameOutdoorExit = this.currentView.endsWith("-room")
          && !!this.transitioningRoomZone
          && this.previewKey === this.getPreviewKey(state);

        if (sameOutdoorExit) {
          this.updateViewState(this.currentZone || state.zone, state.alertLevel || "OFFLINE");
          this.renderAgentMarkers(state);
          return;
        }

        if (this.currentView.endsWith("-room") && !this.transitioningRoomZone) {
          this.startOutdoorExit(state);
          return;
        }

        if (this.transitioningRoomZone || !sameOutdoorPreview) {
          this.startOutdoorPatrol(state);
          return;
        }

        this.updateViewState(state.zone, state.alertLevel || "OFFLINE");
        this.renderAgentMarkers(state);
        return;
      }

      const sameRoomView = this.currentView === `${state.zone}-room`;
      const samePreview = this.currentView === "town" && this.previewKey === this.getPreviewKey(state);

      if (this.transitioningRoomZone && this.transitioningRoomZone !== state.zone) {
        this.clearPreviewTimer();
        this.startZonePreview(state);
        return;
      }

      if (this.currentView.endsWith("-room") && this.currentZone && this.currentZone !== state.zone && !this.transitioningRoomZone) {
        this.startZoneTransfer(state);
        return;
      }

      if (!sameRoomView && !samePreview && !this.transitioningRoomZone) {
        this.startZonePreview(state);
        return;
      }

      if (this.transitioningRoomZone === state.zone) {
        this.updateViewState(state.zone, state.alertLevel || "OFFLINE");
        this.renderAgentMarkers(state);
        return;
      }

      if (samePreview) {
        this.updateViewState(state.zone, state.alertLevel || "OFFLINE");
        this.renderAgentMarkers(state);
        return;
      }

      this.clearPreviewTimer();
      this.updateViewState(state.zone, state.alertLevel || "OFFLINE");

      const roomPosition = this.resolveFocusedAgentPosition(state, false);
      if (!roomPosition) {
        this.clearRobot();
        return;
      }

      this.placeRobot(roomPosition, state.alertLevel, state.zone, state);
    }

    placeRobot(position, alertLevel, zone, state = null) {
      const agents = Array.isArray(state?.openclaw?.agents) ? state.openclaw.agents : [];
      const focusedAgent = agents.find((item) => item.id === (state?.focusedAgentId || 'main')) || agents.find((item) => item.id === 'main') || agents[0] || null;
      this.nameplate.setText(focusedAgent?.id || state?.focusedAgentId || 'main');
      this.renderAgentMarkers(state);
      if (this.currentView.endsWith("-room") && this.syncRobotProxyToFocusedMarker(alertLevel, zone, false)) {
        return;
      }
      void this.moveRobotTo(position, alertLevel, zone, 280, this.currentView === "town");
    }

    clearRobot() {
      this.player.stop();
      this.player.setVisible(false);
      this.shadow.setVisible(false);
      this.nameplate.setVisible(false);
      this.clearAgentMarkers();
    }
  }

  function ensureScene() {
    return sceneRef || null;
  }

  function init(container) {
    if (game || !container) {
      return;
    }

    game = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: container,
      width: ROOM_WORLD_W,
      height: ROOM_WORLD_H,
      backgroundColor: "#101827",
      pixelArt: true,
      antialias: false,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: ROOM_WORLD_W,
        height: ROOM_WORLD_H,
      },
      scene: [OpenClawMapScene],
    });
  }

  function apply(state) {
    pendingState = state;
    ensureScene()?.applyState(state);
  }

  function resize() {
    if (!ensureScene()) {
      return;
    }

    if (game?.scale && typeof game.scale.refresh === "function") {
      game.scale.refresh();
    }
  }

  window.OpenClawPhaserTownMap = {
    init,
    apply,
    resize,
    getDebugState() {
      const scene = ensureScene();
      if (!scene) {
        return null;
      }

      return {
        currentView: scene.currentView,
        currentZone: scene.currentZone,
        focusedAgentId: pendingState?.focusedAgentId || "main",
        agentMarkerIds: Array.isArray(scene.lastRenderedAgentIds) ? [...scene.lastRenderedAgentIds] : [],
        agents: Array.isArray(scene.agentMarkers)
          ? scene.agentMarkers.map((marker) => ({
              id: marker?.__agentId || "",
              zone: marker?.__agentZone || "",
              x: marker?.x ?? null,
              y: marker?.y ?? null,
            }))
          : [],
        sourceAgents: Array.isArray(pendingState?.openclaw?.agents)
          ? pendingState.openclaw.agents.map((agent) => ({
              id: agent?.id || "",
              zone: agent?.zone || "",
              position: agent?.position || null,
              mapPosition: agent?.mapPosition || null,
            }))
          : [],
      };
    },
    clearRobot() {
      ensureScene()?.clearRobot();
    },
  };

  window.__pokemonClawPhaserRuntimeReady = true;
})();
