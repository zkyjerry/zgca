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

      this.add.image(0, 0, "world-ground").setOrigin(0);
      this.add.image(0, 0, "world-walls").setOrigin(0);

      this.colliders = this.physics.add.staticGroup();
      this.createShopObjects();
      this.createPlayer();
      this.createInput();

      this.cameras.main.startFollow(this.player!, true, 0.12, 0.12);
      this.cameras.main.setZoom(1.5);
      this.physics.add.collider(this.player!, this.colliders);

      this.updateHud({
        status: "在奶茶街区逛逛看，靠近物品会出现互动提示。",
        speaker: "街区广播",
        dialog: "欢迎来到 Boba House 街区。方向键或 WASD 移动，按 E 与物品互动。",
      });
    }

    update() {
      if (!this.player || !this.cursors || !this.wasd) {
        return;
      }

      const speed = 132;
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
      this.createRoomBoundaries();
      this.createBobaShop();
      this.createStreet();
      this.createParcelStation();
      this.createConvenienceStore();
      this.createClinic();
    }

    private createRoomBoundaries() {
      this.addRoomBounds(ROOMS.boba);
      this.addRoomBounds(ROOMS.convenience);
      this.addRoomBounds(ROOMS.parcel);
      this.addRoomBounds(ROOMS.clinic);
    }

    private createBobaShop() {
      this.addCounter(64, 80, 7, "点单台", "#9b5a3a");
      this.addCounter(176, 80, 4, "操作台", "#9b5a3a");
      this.addCounter(240, 80, 3, "取餐台", "#9b5a3a");

      this.addMachine(92, 130, "register");
      this.addMachine(180, 130, "sealer");
      this.addMachine(228, 130, "fridge");
      this.addMachine(300, 112, "menu");
      this.addMachine(38, 142, "plant");

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

    private addRoomBounds(room: RoomDefinition) {
      const wall = WALL_THICKNESS;
      const doorStart = room.doorCenter - room.doorWidth / 2;
      const doorEnd = room.doorCenter + room.doorWidth / 2;

      this.addCollider(room.x + wall / 2, room.y + room.height / 2, wall, room.height);
      this.addCollider(room.x + room.width - wall / 2, room.y + room.height / 2, wall, room.height);

      if (room.doorSide === "top") {
        this.addWallSegment(room.x, room.y, doorStart, wall);
        this.addWallSegment(doorEnd, room.y, room.x + room.width, wall);
        this.addCollider(room.x + room.width / 2, room.y + room.height - wall / 2, room.width, wall);
        return;
      }

      this.addCollider(room.x + room.width / 2, room.y + wall / 2, room.width, wall);
      this.addWallSegment(room.x, room.y + room.height - wall, doorStart, wall);
      this.addWallSegment(doorEnd, room.y + room.height - wall, room.x + room.width, wall);
    }

    private addWallSegment(startX: number, y: number, endX: number, height: number) {
      const width = endX - startX;

      if (width <= 0) {
        return;
      }

      this.addCollider(startX + width / 2, y + height / 2, width, height);
    }

    private createStreet() {
      this.add.image(494, 158, "street-sign").setDepth(3);
      this.add.image(468, 356, "bench").setDepth(3);
      this.add.image(476, 462, "street-lamp").setDepth(4);
      this.add.image(912, 360, "street-lamp").setDepth(4);
      this.add.image(736, 354, "bicycle").setDepth(3);
      this.add.image(980, 350, "vending").setDepth(3);

      this.addCollider(494, 169, 24, 18);
      this.addCollider(468, 366, 70, 22);
      this.addCollider(476, 476, 16, 42);
      this.addCollider(912, 374, 16, 42);
      this.addCollider(736, 366, 52, 22);
      this.addCollider(980, 361, 38, 50);

      this.addInteractable({
        id: "street-sign",
        label: "街区导览牌",
        x: 494,
        y: 182,
        radius: 36,
        speaker: "导览牌",
        dialog: "这条小街从 Boba House 延伸出去，右边是便利店，下方有外卖驿站和诊所。",
      });
      this.addInteractable({
        id: "bench",
        label: "街边长椅",
        x: 468,
        y: 366,
        radius: 42,
        speaker: "街边长椅",
        dialog: "椅子上贴着便利店的促销贴纸，还有一张被风吹皱的外卖小票。",
      });
      this.addInteractable({
        id: "vending",
        label: "自动售货机",
        x: 980,
        y: 354,
        radius: 38,
        speaker: "自动售货机",
        dialog: "里面有气泡水、创可贴和能量饮料。最下面一排的灯有点闪。",
      });
    }

    private createParcelStation() {
      this.add.image(120, 442, "parcel-counter").setDepth(3);
      this.add.image(196, 444, "parcel-shelves").setDepth(3);
      this.add.image(84, 526, "parcel-stack").setDepth(3);
      this.add.image(266, 526, "parcel-stack").setDepth(3);

      this.addCollider(154, 448, 190, 36);
      this.addCollider(196, 447, 72, 40);
      this.addCollider(84, 526, 48, 42);
      this.addCollider(266, 526, 48, 42);

      this.addStoreLabel(78, 374, "外卖驿站", "#5c6d9a", "#edf4ff");

      this.addInteractable({
        id: "parcel-desk",
        label: "外卖驿站",
        x: 120,
        y: 462,
        radius: 48,
        speaker: "驿站店员",
        dialog: "货架上按颜色分区：蓝色是今日达，黄色是冷链，粉色是奶茶街的跑腿单。",
      });
      this.addInteractable({
        id: "parcel-stack",
        label: "包裹堆",
        x: 266,
        y: 526,
        radius: 36,
        speaker: "包裹堆",
        dialog: "有一个纸箱上写着“给诊所的药箱”，胶带贴得非常认真。",
      });
    }

    private createConvenienceStore() {
      this.add.image(612, 118, "store-shelves").setDepth(3);
      this.add.image(752, 118, "store-shelves").setDepth(3);
      this.add.image(684, 206, "store-counter").setDepth(3);
      this.add.image(844, 188, "cooler").setDepth(3);
      this.add.image(586, 222, "snack-rack").setDepth(3);

      this.addCollider(612, 118, 98, 36);
      this.addCollider(752, 118, 98, 36);
      this.addCollider(684, 210, 118, 38);
      this.addCollider(844, 188, 44, 78);
      this.addCollider(586, 222, 48, 48);

      this.addStoreLabel(610, 50, "便利店", "#2c7967", "#eefdf3");

      this.addInteractable({
        id: "convenience-counter",
        label: "便利店收银台",
        x: 684,
        y: 228,
        radius: 44,
        speaker: "便利店收银台",
        dialog: "收银台旁边摆着关东煮和刚补货的饭团，热气把小灯牌烘得亮亮的。",
      });
      this.addInteractable({
        id: "cooler",
        label: "冷柜",
        x: 844,
        y: 204,
        radius: 42,
        speaker: "冷柜",
        dialog: "玻璃门后排着冰咖啡、酸奶和给奶茶店备用的鲜奶。",
      });
      this.addInteractable({
        id: "snack-rack",
        label: "零食架",
        x: 586,
        y: 238,
        radius: 36,
        speaker: "零食架",
        dialog: "薯片、软糖、海苔卷挤在一起，中间夹着一包限定口味奶茶糖。",
      });
    }

    private createClinic() {
      this.add.image(592, 542, "clinic-desk").setDepth(3);
      this.add.image(690, 532, "clinic-bed").setDepth(3);
      this.add.image(798, 520, "medicine-cabinet").setDepth(3);
      this.add.image(610, 604, "clinic-chair").setDepth(3);
      this.add.image(738, 604, "clinic-chair").setDepth(3);

      this.addCollider(592, 548, 72, 40);
      this.addCollider(690, 532, 96, 42);
      this.addCollider(798, 520, 48, 84);
      this.addCollider(610, 604, 28, 28);
      this.addCollider(738, 604, 28, 28);

      this.addStoreLabel(608, 470, "社区诊所", "#9b4150", "#fff0f3");

      this.addInteractable({
        id: "clinic-desk",
        label: "诊所问诊台",
        x: 592,
        y: 566,
        radius: 42,
        speaker: "诊所护士",
        dialog: "桌上有体温计、登记本和一杯少糖奶茶，医生说今天要少喝冰的。",
      });
      this.addInteractable({
        id: "clinic-bed",
        label: "检查床",
        x: 690,
        y: 552,
        radius: 42,
        speaker: "检查床",
        dialog: "干净的床单叠得很整齐，旁边的小推车上放着备用纱布。",
      });
      this.addInteractable({
        id: "medicine-cabinet",
        label: "药品柜",
        x: 798,
        y: 548,
        radius: 40,
        speaker: "药品柜",
        dialog: "柜门贴着分类标签：感冒、肠胃、外伤。最上层还有一排薄荷糖。",
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

    private addCounter(x: number, y: number, tiles: number, _label: string, tint: string) {
      for (let i = 0; i < tiles; i += 1) {
        const counter = this.add.image(x + i * TILE, y, "counter").setTint(Phaser.Display.Color.HexStringToColor(tint).color);
        counter.setDepth(3);
        this.addCollider(counter.x, counter.y + 6, TILE, TILE + 10);
      }
    }

    private addMachine(x: number, y: number, texture: string) {
      this.add.image(x, y, texture).setDepth(4);
      this.addCollider(x, y + 5, 28, 26);
    }

    private addTableSet(x: number, y: number) {
      this.add.image(x, y, "table").setDepth(2);
      this.add.image(x - 29, y, "chair").setDepth(2);
      this.add.image(x + 29, y, "chair").setFlipX(true).setDepth(2);
      this.add.image(x, y - 27, "chair").setAngle(90).setDepth(2);
      this.addCollider(x, y, 48, 42);
    }

    private addStoreLabel(x: number, y: number, label: string, background: string, color: string) {
      this.add.text(x, y, label, {
        color,
        fontFamily: "monospace",
        fontSize: "12px",
        fontStyle: "bold",
        backgroundColor: background,
        padding: { x: 7, y: 4 },
      }).setDepth(6);
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
        status: "在奶茶街区逛逛看，靠近物品会出现互动提示。",
        speaker: "街区广播",
        dialog: "欢迎来到 Boba House 街区。方向键或 WASD 移动，按 E 与物品互动。",
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

type RoomDefinition = {
  x: number;
  y: number;
  width: number;
  height: number;
  doorSide: "top" | "bottom";
  doorCenter: number;
  doorWidth: number;
};

const TILE = 32;
const WORLD_WIDTH = 1024;
const WORLD_HEIGHT = 640;
const WALL_THICKNESS = 18;

const ROOMS = {
  boba: { x: 0, y: 0, width: 416, height: 320, doorSide: "bottom", doorCenter: 352, doorWidth: 72 },
  convenience: { x: 544, y: 0, width: 392, height: 300, doorSide: "bottom", doorCenter: 704, doorWidth: 78 },
  parcel: { x: 32, y: 384, width: 320, height: 232, doorSide: "top", doorCenter: 168, doorWidth: 76 },
  clinic: { x: 544, y: 448, width: 352, height: 176, doorSide: "top", doorCenter: 700, doorWidth: 78 },
} satisfies Record<string, RoomDefinition>;

function createPixelAssets(scene: PhaserType.Scene) {
  createWorldGround(scene);
  createWorldWalls(scene);

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
  drawStreetSign(scene);
  drawBench(scene);
  drawStreetLamp(scene);
  drawBicycle(scene);
  drawVending(scene);
  drawParcelCounter(scene);
  drawParcelShelves(scene);
  drawParcelStack(scene);
  drawStoreShelves(scene);
  drawStoreCounter(scene);
  drawCooler(scene);
  drawSnackRack(scene);
  drawClinicDesk(scene);
  drawClinicBed(scene);
  drawMedicineCabinet(scene);
  drawClinicChair(scene);
  drawHero(scene);
}

function createWorldGround(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("world-ground", WORLD_WIDTH, WORLD_HEIGHT)!;
  const ctx = texture.getContext();

  ctx.fillStyle = "#7fac73";
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  drawStreet(ctx, 416, 0, 128, WORLD_HEIGHT, "vertical");
  drawStreet(ctx, 0, 320, WORLD_WIDTH, 64, "horizontal");

  drawRoomFloor(ctx, ROOMS.boba, "#f9dfb3", "#f4ce91");
  drawRoomFloor(ctx, ROOMS.convenience, "#dff4d9", "#c9e8c7");
  drawRoomFloor(ctx, ROOMS.parcel, "#dce7ff", "#c6d6f2");
  drawRoomFloor(ctx, ROOMS.clinic, "#ffe0e8", "#ffd0dd");

  drawPavingStones(ctx, 424, 330, 112, 44);
  drawPavingStones(ctx, 360, 338, 152, 30);
  drawPavingStones(ctx, 544, 338, 440, 30);
  drawPavingStones(ctx, 660, 368, 82, 82);

  ctx.fillStyle = "rgba(255, 248, 232, 0.36)";
  ctx.fillRect(418, 319, 124, 4);
  ctx.fillRect(416, 384, 128, 4);
  ctx.fillRect(0, 318, WORLD_WIDTH, 4);
  ctx.fillRect(0, 384, WORLD_WIDTH, 4);

  texture.refresh();
}

function createWorldWalls(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("world-walls", WORLD_WIDTH, WORLD_HEIGHT)!;
  const ctx = texture.getContext();

  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  drawRoomShell(ctx, ROOMS.boba, {
    wall: "#7f4b30",
    trim: "#4b2f25",
    sign: "#5d8c5b",
    text: "奶茶店",
  });
  drawRoomShell(ctx, ROOMS.convenience, {
    wall: "#2c7967",
    trim: "#17483c",
    sign: "#f5d66f",
    text: "MART",
  });
  drawRoomShell(ctx, ROOMS.parcel, {
    wall: "#5c6d9a",
    trim: "#2f3e69",
    sign: "#ffe08a",
    text: "POST",
  });
  drawRoomShell(ctx, ROOMS.clinic, {
    wall: "#9b4150",
    trim: "#5e2530",
    sign: "#fff6f7",
    text: "CLINIC",
  });

  drawFacadeWindow(ctx, 40, 296);
  drawDoorOnRoom(ctx, ROOMS.boba, "#ffd782");
  drawDoorOnRoom(ctx, ROOMS.convenience, "#e8fff4");
  drawDoorOnRoom(ctx, ROOMS.parcel, "#edf4ff");
  drawDoorOnRoom(ctx, ROOMS.clinic, "#fff0f3");

  drawStreetMarkings(ctx);
  texture.refresh();
}

function drawRoomFloor(
  ctx: CanvasRenderingContext2D,
  room: RoomDefinition,
  primary: string,
  secondary: string,
) {
  ctx.fillStyle = primary;
  ctx.fillRect(room.x, room.y, room.width, room.height);

  for (let y = room.y; y < room.y + room.height; y += TILE) {
    for (let x = room.x; x < room.x + room.width; x += TILE) {
      ctx.fillStyle = ((x - room.x) / TILE + (y - room.y) / TILE) % 2 === 0 ? primary : secondary;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = "rgba(72, 55, 38, 0.22)";
      ctx.strokeRect(x + 0.5, y + 0.5, TILE, TILE);
    }
  }
}

function drawStreet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  direction: "horizontal" | "vertical",
) {
  ctx.fillStyle = "#4b5558";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = "#394144";
  ctx.fillRect(x + 6, y + 6, width - 12, height - 12);
  ctx.strokeStyle = "rgba(255, 248, 232, 0.16)";

  if (direction === "horizontal") {
    for (let lineX = x + 24; lineX < x + width; lineX += 64) {
      ctx.fillStyle = "#f4d66d";
      ctx.fillRect(lineX, y + height / 2 - 2, 32, 4);
    }
  } else {
    for (let lineY = y + 24; lineY < y + height; lineY += 64) {
      ctx.fillStyle = "#f4d66d";
      ctx.fillRect(x + width / 2 - 2, lineY, 4, 32);
    }
  }
}

function drawPavingStones(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  ctx.fillStyle = "#d8c7a2";
  ctx.fillRect(x, y, width, height);

  for (let tileY = y; tileY < y + height; tileY += 12) {
    for (let tileX = x; tileX < x + width; tileX += 24) {
      ctx.strokeStyle = "rgba(82, 70, 53, 0.28)";
      ctx.strokeRect(tileX + 0.5, tileY + 0.5, 24, 12);
    }
  }
}

function drawRoomShell(
  ctx: CanvasRenderingContext2D,
  room: RoomDefinition,
  theme: { wall: string; trim: string; sign: string; text: string },
) {
  const wall = WALL_THICKNESS;

  ctx.fillStyle = theme.wall;
  ctx.fillRect(room.x, room.y, room.width, wall + 36);
  ctx.fillStyle = theme.trim;
  ctx.fillRect(room.x, room.y + wall + 34, room.width, 7);
  ctx.fillRect(room.x, room.y, wall, room.height);
  ctx.fillRect(room.x + room.width - wall, room.y, wall, room.height);
  drawDoorAwareBottomOrTopWall(ctx, room, theme.trim);

  ctx.fillStyle = theme.sign;
  ctx.fillRect(room.x + 30, room.y + 14, 104, 24);
  ctx.fillStyle = "#fff8e8";
  ctx.font = "bold 13px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(theme.text, room.x + 82, room.y + 26);
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

function drawDoorAwareBottomOrTopWall(
  ctx: CanvasRenderingContext2D,
  room: RoomDefinition,
  color: string,
) {
  const y = room.doorSide === "bottom" ? room.y + room.height - WALL_THICKNESS : room.y;
  const doorStart = room.doorCenter - room.doorWidth / 2;
  const doorEnd = room.doorCenter + room.doorWidth / 2;

  ctx.fillStyle = color;
  ctx.fillRect(room.x, y, Math.max(0, doorStart - room.x), WALL_THICKNESS);
  ctx.fillRect(doorEnd, y, Math.max(0, room.x + room.width - doorEnd), WALL_THICKNESS);

  if (room.doorSide === "bottom") {
    ctx.fillRect(room.x, room.y, room.width, WALL_THICKNESS);
  } else {
    ctx.fillRect(room.x, room.y + room.height - WALL_THICKNESS, room.width, WALL_THICKNESS);
  }
}

function drawDoorOnRoom(ctx: CanvasRenderingContext2D, room: RoomDefinition, color: string) {
  const width = room.doorWidth - 20;
  const x = room.doorCenter - width / 2;
  const y = room.doorSide === "bottom" ? room.y + room.height - 26 : room.y + 6;

  ctx.fillStyle = "#4b2f25";
  ctx.fillRect(x - 7, y + 12, width + 14, 9);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, 18);
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.fillRect(x + 8, y + 4, width - 16, 5);
}

function drawFacadeWindow(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#4b2f25";
  ctx.fillRect(x + 3, y + 5, 40, 24);
  ctx.fillStyle = "#b8dcc0";
  ctx.fillRect(x + 7, y + 9, 14, 16);
  ctx.fillRect(x + 25, y + 9, 14, 16);
  ctx.fillStyle = "rgba(255, 248, 232, 0.7)";
  ctx.fillRect(x + 10, y + 11, 7, 2);
  ctx.fillRect(x + 28, y + 11, 7, 2);
}

function drawStreetMarkings(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "rgba(255, 248, 232, 0.72)";
  for (let x = 398; x < 552; x += 18) {
    ctx.fillRect(x, 344, 10, 4);
  }

  for (let y = 286; y < 406; y += 18) {
    ctx.fillRect(472, y, 4, 10);
    ctx.fillRect(488, y, 4, 10);
  }
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

function drawStreetSign(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("street-sign", 28, 44)!;
  const ctx = texture.getContext();

  ctx.fillStyle = "#4b2f25";
  ctx.fillRect(12, 16, 4, 24);
  ctx.fillStyle = "#fff8e8";
  ctx.fillRect(3, 2, 22, 16);
  ctx.fillStyle = "#5c6d9a";
  ctx.fillRect(5, 4, 18, 5);
  ctx.fillStyle = "#2c7967";
  ctx.fillRect(5, 10, 18, 3);
  ctx.fillStyle = "#9b4150";
  ctx.fillRect(5, 14, 10, 2);
  texture.refresh();
}

function drawBench(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("bench", 74, 28)!;
  const ctx = texture.getContext();

  ctx.fillStyle = "#7f4b30";
  ctx.fillRect(4, 7, 66, 8);
  ctx.fillRect(8, 16, 58, 6);
  ctx.fillStyle = "#4b2f25";
  ctx.fillRect(10, 22, 4, 4);
  ctx.fillRect(60, 22, 4, 4);
  texture.refresh();
}

function drawStreetLamp(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("street-lamp", 22, 56)!;
  const ctx = texture.getContext();

  ctx.fillStyle = "#4b2f25";
  ctx.fillRect(9, 10, 4, 40);
  ctx.fillRect(6, 48, 10, 4);
  ctx.fillStyle = "#ffd782";
  ctx.fillRect(4, 0, 14, 12);
  ctx.fillStyle = "#fff8e8";
  ctx.fillRect(6, 2, 10, 6);
  texture.refresh();
}

function drawBicycle(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("bicycle", 56, 30)!;
  const ctx = texture.getContext();

  ctx.strokeStyle = "#4b2f25";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(12, 20, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(42, 20, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#5c6d9a";
  ctx.fillRect(18, 12, 10, 2);
  ctx.fillRect(24, 10, 8, 2);
  ctx.fillRect(28, 12, 2, 10);
  ctx.fillRect(18, 12, 2, 8);
  texture.refresh();
}

function drawVending(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("vending", 40, 54)!;
  const ctx = texture.getContext();

  ctx.fillStyle = "#9b4150";
  ctx.fillRect(3, 2, 34, 48);
  ctx.fillStyle = "#fff8e8";
  ctx.fillRect(8, 8, 20, 20);
  ctx.fillStyle = "#b8dcc0";
  ctx.fillRect(10, 10, 16, 4);
  ctx.fillRect(10, 16, 16, 4);
  ctx.fillStyle = "#ffd782";
  ctx.fillRect(10, 22, 16, 4);
  ctx.fillStyle = "#4b2f25";
  ctx.fillRect(30, 10, 3, 20);
  ctx.fillRect(10, 34, 20, 3);
  ctx.fillRect(10, 41, 20, 3);
  texture.refresh();
}

function drawParcelCounter(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("parcel-counter", 86, 36)!;
  const ctx = texture.getContext();

  ctx.fillStyle = "#5c6d9a";
  ctx.fillRect(4, 8, 78, 22);
  ctx.fillStyle = "#8ea2d2";
  ctx.fillRect(4, 8, 78, 6);
  ctx.fillStyle = "#4b2f25";
  ctx.fillRect(4, 29, 78, 4);
  ctx.fillStyle = "#fff8e8";
  ctx.fillRect(12, 15, 24, 8);
  texture.refresh();
}

function drawParcelShelves(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("parcel-shelves", 78, 52)!;
  const ctx = texture.getContext();

  ctx.fillStyle = "#4b2f25";
  ctx.fillRect(6, 5, 66, 4);
  ctx.fillRect(6, 22, 66, 4);
  ctx.fillRect(6, 39, 66, 4);
  ctx.fillRect(10, 5, 4, 40);
  ctx.fillRect(64, 5, 4, 40);
  ctx.fillStyle = "#ffd782";
  ctx.fillRect(16, 11, 16, 9);
  ctx.fillStyle = "#e8798a";
  ctx.fillRect(36, 11, 14, 9);
  ctx.fillStyle = "#b8dcc0";
  ctx.fillRect(18, 28, 16, 9);
  ctx.fillStyle = "#fff8e8";
  ctx.fillRect(42, 28, 10, 9);
  texture.refresh();
}

function drawParcelStack(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("parcel-stack", 48, 44)!;
  const ctx = texture.getContext();

  ctx.fillStyle = "#c78250";
  ctx.fillRect(4, 18, 20, 14);
  ctx.fillRect(20, 6, 24, 16);
  ctx.fillRect(12, 28, 28, 12);
  ctx.fillStyle = "#9b5a3a";
  ctx.fillRect(4, 18, 20, 3);
  ctx.fillRect(20, 6, 24, 3);
  ctx.fillRect(12, 28, 28, 3);
  ctx.fillStyle = "#fff8e8";
  ctx.fillRect(26, 12, 9, 4);
  texture.refresh();
}

function drawStoreShelves(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("store-shelves", 98, 38)!;
  const ctx = texture.getContext();

  ctx.fillStyle = "#2c7967";
  ctx.fillRect(4, 4, 90, 8);
  ctx.fillStyle = "#4b2f25";
  ctx.fillRect(4, 15, 90, 4);
  ctx.fillRect(4, 28, 90, 4);
  ctx.fillStyle = "#ffd782";
  ctx.fillRect(12, 19, 14, 7);
  ctx.fillStyle = "#e8798a";
  ctx.fillRect(32, 19, 14, 7);
  ctx.fillStyle = "#8f7cc0";
  ctx.fillRect(52, 19, 14, 7);
  ctx.fillStyle = "#b8dcc0";
  ctx.fillRect(72, 19, 12, 7);
  texture.refresh();
}

function drawStoreCounter(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("store-counter", 118, 38)!;
  const ctx = texture.getContext();

  ctx.fillStyle = "#7f4b30";
  ctx.fillRect(4, 8, 110, 22);
  ctx.fillStyle = "#c78250";
  ctx.fillRect(4, 8, 110, 6);
  ctx.fillStyle = "#fff8e8";
  ctx.fillRect(12, 15, 22, 8);
  ctx.fillStyle = "#ffd782";
  ctx.fillRect(42, 14, 26, 10);
  ctx.fillStyle = "#4b2f25";
  ctx.fillRect(78, 13, 22, 11);
  texture.refresh();
}

function drawCooler(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("cooler", 46, 82)!;
  const ctx = texture.getContext();

  ctx.fillStyle = "#a9d9d5";
  ctx.fillRect(7, 3, 32, 72);
  ctx.fillStyle = "#4b2f25";
  ctx.fillRect(4, 0, 38, 4);
  ctx.fillRect(4, 75, 38, 4);
  ctx.fillRect(4, 0, 4, 79);
  ctx.fillRect(38, 0, 4, 79);
  ctx.fillStyle = "rgba(255,255,255,0.46)";
  ctx.fillRect(12, 10, 22, 12);
  ctx.fillRect(12, 30, 22, 12);
  ctx.fillRect(12, 50, 22, 12);
  texture.refresh();
}

function drawSnackRack(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("snack-rack", 50, 50)!;
  const ctx = texture.getContext();

  ctx.fillStyle = "#7f4b30";
  ctx.fillRect(8, 4, 34, 6);
  ctx.fillRect(8, 20, 34, 6);
  ctx.fillRect(8, 36, 34, 6);
  ctx.fillStyle = "#4b2f25";
  ctx.fillRect(10, 4, 3, 38);
  ctx.fillRect(37, 4, 3, 38);
  ctx.fillStyle = "#e8798a";
  ctx.fillRect(15, 11, 8, 7);
  ctx.fillStyle = "#ffd782";
  ctx.fillRect(26, 11, 8, 7);
  ctx.fillStyle = "#8f7cc0";
  ctx.fillRect(16, 27, 8, 7);
  ctx.fillStyle = "#b8dcc0";
  ctx.fillRect(27, 27, 7, 7);
  texture.refresh();
}

function drawClinicDesk(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("clinic-desk", 74, 42)!;
  const ctx = texture.getContext();

  ctx.fillStyle = "#9b4150";
  ctx.fillRect(5, 8, 64, 24);
  ctx.fillStyle = "#d98096";
  ctx.fillRect(5, 8, 64, 6);
  ctx.fillStyle = "#fff8e8";
  ctx.fillRect(15, 17, 18, 8);
  ctx.fillStyle = "#4b2f25";
  ctx.fillRect(43, 16, 16, 10);
  texture.refresh();
}

function drawClinicBed(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("clinic-bed", 96, 44)!;
  const ctx = texture.getContext();

  ctx.fillStyle = "#fff8e8";
  ctx.fillRect(8, 10, 78, 20);
  ctx.fillStyle = "#b8dcc0";
  ctx.fillRect(10, 12, 24, 10);
  ctx.fillStyle = "#4b2f25";
  ctx.fillRect(6, 8, 4, 28);
  ctx.fillRect(84, 8, 4, 28);
  ctx.fillRect(16, 30, 4, 8);
  ctx.fillRect(74, 30, 4, 8);
  texture.refresh();
}

function drawMedicineCabinet(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("medicine-cabinet", 50, 88)!;
  const ctx = texture.getContext();

  ctx.fillStyle = "#fff8e8";
  ctx.fillRect(6, 4, 38, 76);
  ctx.fillStyle = "#9b4150";
  ctx.fillRect(6, 4, 38, 5);
  ctx.fillStyle = "#4b2f25";
  ctx.fillRect(4, 2, 42, 4);
  ctx.fillRect(4, 80, 42, 4);
  ctx.fillRect(4, 2, 4, 82);
  ctx.fillRect(42, 2, 4, 82);
  ctx.fillRect(8, 28, 34, 3);
  ctx.fillRect(8, 53, 34, 3);
  ctx.fillStyle = "#b8dcc0";
  ctx.fillRect(12, 13, 10, 9);
  ctx.fillStyle = "#ffd782";
  ctx.fillRect(26, 13, 10, 9);
  ctx.fillStyle = "#e8798a";
  ctx.fillRect(14, 38, 8, 9);
  ctx.fillStyle = "#8f7cc0";
  ctx.fillRect(26, 38, 10, 9);
  texture.refresh();
}

function drawClinicChair(scene: PhaserType.Scene) {
  const texture = scene.textures.createCanvas("clinic-chair", 28, 28)!;
  const ctx = texture.getContext();

  ctx.fillStyle = "#d98096";
  ctx.fillRect(7, 6, 14, 11);
  ctx.fillStyle = "#4b2f25";
  ctx.fillRect(8, 17, 3, 7);
  ctx.fillRect(17, 17, 3, 7);
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
