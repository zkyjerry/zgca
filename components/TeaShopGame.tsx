"use client";

import { useEffect, useRef, useState } from "react";
import { createTeaShopGame, type TeaShopHudState } from "@/game/createTeaShopGame";

const initialHud: TeaShopHudState = {
  status: "在店里走走看，靠近物品会出现互动提示。",
  speaker: "店内广播",
  dialog: "欢迎来到 Boba House。方向键或 WASD 移动，按 E 与物品互动。",
};

export default function TeaShopGame() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [hud, setHud] = useState<TeaShopHudState>(initialHud);

  useEffect(() => {
    if (!mountRef.current) {
      return;
    }

    let cancelled = false;
    let game: { destroy: (removeCanvas: boolean) => void } | null = null;

    createTeaShopGame(mountRef.current, (nextHud) => {
      if (!cancelled) {
        setHud(nextHud);
      }
    }).then((createdGame) => {
      if (cancelled) {
        createdGame.destroy(true);
        return;
      }

      game = createdGame;
    });

    return () => {
      cancelled = true;
      game?.destroy(true);
    };
  }, []);

  return (
    <main className="shell">
      <section className="gameFrame" aria-label="Boba House 2D 像素风游戏">
        <div className="gameViewport">
          <div ref={mountRef} className="gameMount" />
        </div>

        <aside className="hudPanel" aria-live="polite">
          <div className="brandBlock">
            <span className="eyebrow">Pixel Tea Shop</span>
            <h1>Boba House</h1>
            <p>一间带着茶香、封口机声音和下午光线的小奶茶店。</p>
          </div>

          <div className="statusBox">
            <span className="statusLabel">当前状态</span>
            <p className="statusText">{hud.status}</p>
          </div>

          <div className="controlsBox" aria-label="操作说明">
            <span className="keycap">WASD</span>
            <span className="keycap">方向键</span>
            <span className="keycap">E 互动</span>
            <span className="keycap">再次 E 关闭</span>
          </div>

          <div className="dialogBox">
            <p className="dialogName">{hud.speaker}</p>
            <p className="dialogText">{hud.dialog}</p>
          </div>
        </aside>
      </section>
    </main>
  );
}
