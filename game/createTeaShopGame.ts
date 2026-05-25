import type PhaserType from "phaser";

export type TeaShopHudState = {
  status: string;
  speaker: string;
  dialog: string;
};

export type HudUpdater = (state: TeaShopHudState) => void;

export async function createTeaShopGame(parent: HTMLElement, onHudChange: HudUpdater) {
  const Phaser = await import("phaser");

  class TeaShopScene extends Phaser.Scene {
    private player?: PhaserType.Types.Physics.Arcade.SpriteWithDynamicBody;
    private cursors?: PhaserType.Types.Input.Keyboard.CursorKeys;
    private wasd?: Record<"W" | "A" | "S" | "D" | "E", PhaserType.Input.Keyboard.Key>;
    private colliders?: PhaserType.Physics.Arcade.StaticGroup;
    private interactables: Interactable[] = [];
    private activeInteractable?: Interactable;
    private dialogOpen = true;
    private facing: Direction = "down";
    private lastHudKey = "";

    constructor() {
      super("TeaShopScene");
    }

    preload() {
      createPixelAssets(this);
    }

    create() {
      this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      this.cameras.main.setBackgroundColor("#1b1716");
      this.cameras.main.roundPixels = true;

      this.add.image(0, 0, "shop-floor").setOrigin(0);
      this.add.image(0, 0, "shop-walls").setOrigin(0);

      this.colliders = this.physics.add.staticGroup();
      this.createShopObjects();
      this.createPlayer();
      this.createInput();

      this.cameras.main.startFollow(this.player!, true, 0.12, 0.12);
      this.cameras.main.setZoom(2);
      this.physics.add.collider(this.player!, this.colliders);

      this.updateHud({
        status: "在店里走走看，靠近物品会出现互动提示。",
        speaker: "店内广播",
        dialog: "欢迎来到 Boba House。方向键或 WASD 移动，按 E 与物品互动。",
      });
    }

    update() {
      if (!this.player || !this.cursors || !this.wasd) {
        return;
      }

      const speed = 118;
      const left = this.cursors.left.isDown || this.wasd.A.isDown;
      const right = this.cursors.right.isDown || this.wasd.D.isDown;
      const up = this.cursors.up.isDown || this.wasd.W.isDown;
      const down = this.cursors.down.isDown || this.wasd.S.isDown;

      const velocity = new Phaser.Math.Vector2(Number(right) - Number(left), Number(down) - Number(up));

      if (velocity.lengthSq() > 0) {
        velocity.normalize().scale(speed);
        this.player.setVelocity(velocity.x, velocity.y);
        this.dialogOpen = false;

        if (Math.abs(velocity.x) > Math.abs(velocity.y)) {
          this.facing = velocity.x > 0 ? "right" : "left";
        } else {
          this.facing = velocity.y > 0 ? "down" : "up";
        }

        this.player.anims.play(`walk-${this.facing}`, true);
      } else {
        this.player.setVelocity(0, 0);
        this.player.anims.play(`idle-${this.facing}`, true);
      }

      const nearest = this.findNearestInteractable();

      if (Phaser.Input.Keyboard.JustDown(this.wasd.E) && nearest) {
        if (this.dialogOpen && this.activeInteractable === nearest) {
          this.dialogOpen = false;
        } else {
          this.dialogOpen = true;
          this.activeInteractable = nearest;
        }
      }

      if (!nearest) {
        this.activeInteractable = undefined;
        this.dialogOpen = false;
      }

      this.syncHud(nearest);
    }

    private createShopObjects() {
      this.addCounter(64, 80, 7, "点单台", "#9b5a3a");
      this.addCounter(176, 80, 4, "操作台", "#9b5a3a");
      this.addCounter(240, 80, 3, "取餐台", "#9b5a3a");

      this.addMachine(92, 130, "register", "点单台");
      this.addMachine(180, 130, "sealer", "封口机");
      this.addMachine(228, 130, "fridge", "冰箱");
      this.addMachine(300, 112, "menu", "菜单牌");
      this.addMachine(38, 142, "plant", "绿植");

      this.addTableSet(76, 224);
      this.addTableSet(236, 222);
      this.addTableSet(332, 206);

      this.add.image(352, 296, "door").setDepth(1);
      this.add.image(40, 296, "window").setDepth(1);

      this.addInteractable({
        id: "register",
        label: "点单台",
        x: 92,
        y: 146,
        radius: 38,
        speaker: "点单台",
        dialog: "欢迎光临，今天的推荐是草莓芝士奶盖和抹茶珍珠。",
      });
      this.addInteractable({
        id: "menu",
        label: "菜单牌",
        x: 300,
        y: 126,
        radius: 36,
        speaker: "菜单牌",
        dialog: "招牌：黑糖珍珠、芋泥波波、抹茶拿铁、桃桃乌龙。",
      });
      this.addInteractable({
        id: "sealer",
        label: "封口机",
        x: 180,
        y: 146,
        radius: 34,
        speaker: "封口机",
        dialog: "封口机嗡嗡作响，杯膜上印着一只笑脸。",
      });
      this.addInteractable({
        id: "fridge",
        label: "冰箱",
        x: 228,
        y: 146,
        radius: 34,
        speaker: "冰箱",
        dialog: "里面放着牛奶、茶底、珍珠和一整盒刚切好的芋圆。",
      });
      this.addInteractable({
        id: "table",
        label: "桌椅",
        x: 236,
        y: 222,
        radius: 42,
        speaker: "靠窗座位",
        dialog: "桌上有没喝完的奶茶，冰块碰到杯壁发出轻轻的声音。",
      });
      this.addInteractable({
        id: "plant",
        label: "绿植",
        x: 38,
        y: 150,
        radius: 30,
        speaker: "绿植",
        dialog: "叶子被照顾得很好，旁边藏着一张打卡贴纸。",
      });
    }

    private createPlayer() {
      this.player = this.physics.add.sprite(208, 246, "hero", 0);
      this.player.setDepth(8);
      this.player.setSize(14, 14);
      this.player.setOffset(9, 18);
      this.player.setCollideWorldBounds(true);

      const frameRate = 7;
      this.anims.create({ key: "idle-down", frames: [{ key: "hero", frame: 0 }], frameRate });
      this.anims.create({ key: "idle-left", frames: [{ key: "hero", frame: 4 }], frameRate });
      this.anims.create({ key: "idle-right", frames: [{ key: "hero", frame: 8 }], frameRate });
      this.anims.create({ key: "idle-up", frames: [{ key: "hero", frame: 12 }], frameRate });
      this.anims.create({ key: "walk-down", frames: this.anims.generateFrameNumbers("hero", { start: 0, end: 3 }), frameRate, repeat: -1 });
      this.anims.create({ key: "walk-left", frames: this.anims.generateFrameNumbers("hero", { start: 4, end: 7 }), frameRate, repeat: -1 });
      this.anims.create({ key: "walk-right", frames: this.anims.generateFrameNumbers("hero", { start: 8, end: 11 }), frameRate, repeat: -1 });
      this.anims.create({ key: "walk-up", frames: this.anims.generateFrameNumbers("hero", { start: 12, end: 15 }), frameRate, repeat: -1 });
    }

    private createInput() {
      this.cursors = this.input.keyboard!.createCursorKeys();
      this.wasd = this.input.keyboard!.addKeys("W,A,S,D,E") as Record<"W" | "A" | "S" | "D" | "E", PhaserType.Input.Keyboard.Key>;
    }

    private addCounter(x: number, y: number, tiles: number, label: string, tint: string) {
      for (let i = 0; i < tiles; i += 1) {
        const counter = this.add.image(x + i * TILE, y, "counter").setTint(Phaser.Display.Color.HexStringToColor(tint).color);
        counter.setDepth(3);
        this.addCollider(counter.x, counter.y + 6, TILE, TILE + 10);
      }

      this.add.text(x + 4, y - 15, label, {
        color: "#fff8e8",
        fontFamily: "monospace",
        fontSize: "7px",
        backgroundColor: "rgba(75,47,37,0.82)",
        padding: { x: 3, y: 2 },
      }).setDepth(5);
    }

    private addMachine(x: number, y: number, texture: string, label: string) {
      this.add.image(x, y, texture).setDepth(4);
      this.addCollider(x, y + 5, 28, 26);
      this.add.text(x - 18, y + 19, label, {
        color: "#4b2f25",
        fontFamily: "monospace",
        fontSize: "6px",
        backgroundColor: "rgba(255,248,232,0.72)",
        padding: { x: 2, y: 1 },
      }).setDepth(6);
    }

    private addTableSet(x: number, y: number) {
      this.add.image(x, y, "table").setDepth(2);
      this.add.image(x - 29, y, "chair").setDepth(2);
      this.add.image(x + 29, y, "chair").setFlipX(true).setDepth(2);
      this.add.image(x, y - 27, "chair").setAngle(90).setDepth(2);
      this.addCollider(x, y, 48, 42);
    }

    private addCollider(x: number, y: number, width: number, height: number) {
      const body = this.add.rectangle(x, y, width, height, 0x000000, 0);
      this.physics.add.existing(body, true);
      this.colliders?.add(body);
    }

    private addInteractable(interactable: Interactable) {
      this.interactables.push(interactable);
      const marker = this.add.circle(interactable.x, interactable.y, interactable.radius, 0xffd782, 0.07);
      marker.setStrokeStyle(1, 0xfff1b2, 0.22);
      marker.setDepth(0);
    }

    private findNearestInteractable() {
      if (!this.player) {
        return undefined;
      }

      let nearest: Interactable | undefined;
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (const interactable of this.interactables) {
        const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, interactable.x, interactable.y);

        if (distance <= interactable.radius && distance < nearestDistance) {
          nearest = interactable;
          nearestDistance = distance;
        }
      }

      return nearest;
    }

    private syncHud(nearest?: Interactable) {
      if (this.dialogOpen && this.activeInteractable) {
        this.updateHud({
          status: `正在查看：${this.activeInteractable.label}`,
          speaker: this.activeInteractable.speaker,
          dialog: this.activeInteractable.dialog,
        });
        return;
      }

      if (nearest) {
        this.updateHud({
          status: `靠近了 ${nearest.label}，按 E 互动。`,
          speaker: nearest.speaker,
          dialog: "按 E 了解这里的小细节。",
        });
        return;
      }

      this.updateHud({
        status: "在店里走走看，靠近物品会出现互动提示。",
        speaker: "店内广播",
        dialog: "欢迎来到 Boba House。方向键或 WASD 移动，按 E 与物品互动。",
      });
    }

    private updateHud(state: TeaShopHudState) {
      const nextKey = `${state.status}|${state.speaker}|${state.dialog}`;

      if (nextKey === this.lastHudKey) {
        return;
      }

      this.lastHudKey = nextKey;
      onHudChange(state);
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 640,
    height: 360,
    backgroundColor: "#1b1716",
    pixelArt: true,
    roundPixels: true,
    physics: {
      default: "arcade",
      arcade: {
        debug: false,
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: TeaShopScene,
  });

  return game;
}

type Direction = "down" | "left" | "right" | "up";

type Interactable = {
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
  speaker: string;
  dialog: string;
};

const TILE = 32;
const WORLD_WIDTH = 416;
const WORLD_HEIGHT = 320;

function createPixelAssets(scene: PhaserType.Scene) {
  const floor = scene.textures.createCanvas("shop-floor", WORLD_WIDTH, WORLD_HEIGHT);
  const floorCtx = floor!.getContext();

  floorCtx.fillStyle = "#f8d9a6";
  floorCtx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  for (let y = 0; y < WORLD_HEIGHT; y += TILE) {
    for (let x = 0; x < WORLD_WIDTH; x += TILE) {
      floorCtx.fillStyle = (x / TILE + y / TILE) % 2 === 0 ? "#f9dfb3" : "#f4ce91";
      floorCtx.fillRect(x, y, TILE, TILE);
      floorCtx.strokeStyle = "rgba(127, 75, 48, 0.28)";
      floorCtx.strokeRect(x + 0.5, y + 0.5, TILE, TILE);
    }
  }

  floor!.refresh();

  const walls = scene.textures.createCanvas("shop-walls", WORLD_WIDTH, WORLD_HEIGHT);
  const wallCtx = walls!.getContext();

  wallCtx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  wallCtx.fillStyle = "#7f4b30";
  wallCtx.fillRect(0, 0, WORLD_WIDTH, 54);
  wallCtx.fillStyle = "#4b2f25";
  wallCtx.fillRect(0, 52, WORLD_WIDTH, 7);
  wallCtx.fillRect(0, 0, 18, WORLD_HEIGHT);
  wallCtx.fillRect(WORLD_WIDTH - 18, 0, 18, WORLD_HEIGHT);
  wallCtx.fillStyle = "#ffd782";
  wallCtx.fillRect(30, 14, 82, 24);
  wallCtx.fillStyle = "#fff8e8";
  wallCtx.fillRect(34, 18, 74, 16);
  wallCtx.fillStyle = "#5d8c5b";
  wallCtx.fillRect(254, 14, 104, 24);
  wallCtx.fillStyle = "#fff8e8";
  wallCtx.font = "bold 12px monospace";
  wallCtx.fillText("BOBA", 288, 31);
  walls!.refresh();

  drawCounter(scene);
  drawRegister(scene);
  drawSealer(scene);
  drawFridge(scene);
  drawMenu(scene);
  drawPlant(scene);
  drawTable(scene);
  drawChair(scene);
  drawDoor(scene);
  drawWindow(scene);
  drawHero(scene);
}

function drawCounter(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("counter", 32, 32)!;
  const ctx = texture.getContext();

  ctx.fillStyle = "#9b5a3a";
  ctx.fillRect(0, 4, 32, 24);
  ctx.fillStyle = "#c78250";
  ctx.fillRect(0, 4, 32, 7);
  ctx.fillStyle = "#4b2f25";
  ctx.fillRect(0, 27, 32, 5);
  ctx.fillStyle = "rgba(255, 248, 232, 0.45)";
  ctx.fillRect(3, 7, 26, 2);
  texture.refresh();
}

function drawRegister(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("register", 30, 30)!;
  const ctx = texture.getContext();

  ctx.fillStyle = "#e8798a";
  ctx.fillRect(5, 9, 20, 14);
  ctx.fillStyle = "#4b2f25";
  ctx.fillRect(7, 6, 16, 5);
  ctx.fillStyle = "#fff8e8";
  ctx.fillRect(9, 12, 12, 4);
  ctx.fillStyle = "#ffd782";
  ctx.fillRect(8, 19, 3, 2);
  ctx.fillRect(14, 19, 3, 2);
  ctx.fillRect(20, 19, 3, 2);
  texture.refresh();
}

function drawSealer(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("sealer", 30, 30)!;
  const ctx = texture.getContext();

  ctx.fillStyle = "#5d8c5b";
  ctx.fillRect(6, 7, 18, 18);
  ctx.fillStyle = "#b8dcc0";
  ctx.fillRect(9, 10, 12, 5);
  ctx.fillStyle = "#4b2f25";
  ctx.fillRect(10, 20, 10, 3);
  ctx.fillStyle = "#ffd782";
  ctx.fillRect(22, 12, 3, 3);
  texture.refresh();
}

function drawFridge(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("fridge", 30, 38)!;
  const ctx = texture.getContext();

  ctx.fillStyle = "#8f7cc0";
  ctx.fillRect(6, 3, 18, 31);
  ctx.fillStyle = "#c8b9ec";
  ctx.fillRect(8, 6, 14, 11);
  ctx.fillStyle = "#fff8e8";
  ctx.fillRect(10, 8, 4, 4);
  ctx.fillRect(16, 8, 4, 4);
  ctx.fillStyle = "#4b2f25";
  ctx.fillRect(21, 19, 2, 8);
  texture.refresh();
}

function drawMenu(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("menu", 38, 42)!;
  const ctx = texture.getContext();

  ctx.fillStyle = "#4b2f25";
  ctx.fillRect(5, 4, 28, 34);
  ctx.fillStyle = "#fff8e8";
  ctx.fillRect(8, 7, 22, 28);
  ctx.fillStyle = "#e8798a";
  ctx.fillRect(11, 11, 16, 3);
  ctx.fillStyle = "#5d8c5b";
  ctx.fillRect(11, 18, 16, 2);
  ctx.fillStyle = "#8f7cc0";
  ctx.fillRect(11, 24, 16, 2);
  ctx.fillStyle = "#7f4b30";
  ctx.fillRect(11, 30, 16, 2);
  texture.refresh();
}

function drawPlant(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("plant", 30, 34)!;
  const ctx = texture.getContext();

  ctx.fillStyle = "#9b5a3a";
  ctx.fillRect(10, 22, 10, 9);
  ctx.fillStyle = "#5d8c5b";
  ctx.fillRect(8, 13, 5, 10);
  ctx.fillRect(17, 10, 5, 13);
  ctx.fillStyle = "#78ad6d";
  ctx.fillRect(12, 8, 5, 15);
  ctx.fillStyle = "#4b2f25";
  ctx.fillRect(9, 30, 12, 2);
  texture.refresh();
}

function drawTable(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("table", 42, 36)!;
  const ctx = texture.getContext();

  ctx.fillStyle = "#7f4b30";
  ctx.fillRect(4, 5, 34, 26);
  ctx.fillStyle = "#c78250";
  ctx.fillRect(7, 8, 28, 20);
  ctx.fillStyle = "#fff8e8";
  ctx.fillRect(14, 12, 6, 9);
  ctx.fillStyle = "#e8798a";
  ctx.fillRect(15, 11, 4, 2);
  ctx.fillStyle = "#4b2f25";
  ctx.fillRect(10, 29, 4, 3);
  ctx.fillRect(28, 29, 4, 3);
  texture.refresh();
}

function drawChair(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("chair", 24, 28)!;
  const ctx = texture.getContext();

  ctx.fillStyle = "#5d8c5b";
  ctx.fillRect(7, 5, 12, 17);
  ctx.fillStyle = "#b8dcc0";
  ctx.fillRect(9, 7, 8, 8);
  ctx.fillStyle = "#4b2f25";
  ctx.fillRect(6, 22, 3, 4);
  ctx.fillRect(17, 22, 3, 4);
  texture.refresh();
}

function drawDoor(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("door", 44, 34)!;
  const ctx = texture.getContext();

  ctx.fillStyle = "#4b2f25";
  ctx.fillRect(0, 22, 44, 8);
  ctx.fillStyle = "#ffd782";
  ctx.fillRect(8, 12, 28, 14);
  ctx.fillStyle = "#fff8e8";
  ctx.fillRect(12, 15, 20, 6);
  texture.refresh();
}

function drawWindow(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("window", 46, 34)!;
  const ctx = texture.getContext();

  ctx.fillStyle = "#4b2f25";
  ctx.fillRect(3, 5, 40, 24);
  ctx.fillStyle = "#b8dcc0";
  ctx.fillRect(7, 9, 14, 16);
  ctx.fillRect(25, 9, 14, 16);
  ctx.fillStyle = "rgba(255, 248, 232, 0.7)";
  ctx.fillRect(10, 11, 7, 2);
  ctx.fillRect(28, 11, 7, 2);
  texture.refresh();
}

function drawHero(scene: PhaserType.Scene) {
  const frameSize = 32;
  const canvas = document.createElement("canvas");
  canvas.width = frameSize * 4;
  canvas.height = frameSize * 4;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return;
  }

  const directions: Direction[] = ["down", "left", "right", "up"];

  directions.forEach((direction, row) => {
    for (let frame = 0; frame < 4; frame += 1) {
      const x = frame * frameSize;
      const y = row * frameSize;
      const bob = frame % 2 === 0 ? 0 : 1;
      drawHeroFrame(ctx, x, y + bob, direction, frame);
    }
  });

  const texture = scene.textures.create("hero", canvas);

  if (texture) {
    scene.textures.addSpriteSheet("", texture, {
      frameWidth: frameSize,
      frameHeight: frameSize,
    });
  }
}

function drawHeroFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: Direction,
  frame: number,
) {
  ctx.clearRect(x, y, 32, 32);
  ctx.fillStyle = "#4b2f25";
  ctx.fillRect(x + 11, y + 4, 10, 7);
  ctx.fillRect(x + 9, y + 8, 14, 7);
  ctx.fillStyle = "#f2a98f";
  ctx.fillRect(x + 10, y + 10, 12, 9);
  ctx.fillStyle = "#e8798a";
  ctx.fillRect(x + 9, y + 19, 14, 8);
  ctx.fillStyle = "#fff8e8";
  ctx.fillRect(x + 12, y + 19, 8, 3);
  ctx.fillStyle = "#33221b";

  if (direction === "down") {
    ctx.fillRect(x + 13, y + 14, 2, 2);
    ctx.fillRect(x + 18, y + 14, 2, 2);
  } else if (direction === "left") {
    ctx.fillRect(x + 12, y + 14, 2, 2);
  } else if (direction === "right") {
    ctx.fillRect(x + 19, y + 14, 2, 2);
  } else {
    ctx.fillStyle = "#4b2f25";
    ctx.fillRect(x + 10, y + 10, 12, 6);
  }

  ctx.fillStyle = "#33221b";
  const step = frame === 1 || frame === 3 ? 1 : 0;
  ctx.fillRect(x + 10, y + 27, 5, 3 + step);
  ctx.fillRect(x + 18, y + 27, 5, 3 - step);
}
