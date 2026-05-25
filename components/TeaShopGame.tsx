"use client";

import { useEffect, useRef, useState } from "react";
import { createTeaShopGame, type TeaShopHudState } from "@/game/createTeaShopGame";
import { PauseOverlay } from "@/ui/pause-overlay";
import { DialogueBox } from "@/ui/dialogue-box";
import { EndingCredits } from "@/ui/ending-credits";
import { useDialogueTree } from "@/dialogue/useDialogueTree";
import openingDialogue from "@/data/dialogues/opening.json";

const initialHud: TeaShopHudState = {
  status: "在奶茶街区逛逛看，靠近物品会出现互动提示。",
  speaker: "街区广播",
  dialog: "欢迎来到 Boba House 街区。方向键或 WASD 移动，按 E 与物品互动。",
};

type TeaShopGameProps = {
  onBackToMenu?: () => void;
};

type RuntimeGame = {
  destroy: (removeCanvas: boolean) => void;
  scene: {
    pause: (key: string) => void;
    resume: (key: string) => void;
  };
};

export default function TeaShopGame({ onBackToMenu }: TeaShopGameProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<RuntimeGame | null>(null);
  const [hud, setHud] = useState<TeaShopHudState>(initialHud);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const wasDialogueActiveRef = useRef(false);
  const dialogue = useDialogueTree(openingDialogue);
  const gameplayPaused = paused || dialogue.isActive || showCredits;

  useEffect(() => {
    if (!mountRef.current) {
      return;
    }

    let cancelled = false;
    let game: RuntimeGame | null = null;

    createTeaShopGame(mountRef.current, (nextHud) => {
      if (!cancelled) {
        setHud(nextHud);
      }
    }).then((createdGame) => {
      if (cancelled) {
        createdGame.destroy(true);
        return;
      }

      game = createdGame as RuntimeGame;
      gameRef.current = game;
    });

    return () => {
      cancelled = true;
      gameRef.current = null;
      game?.destroy(true);
    };
  }, []);

  useEffect(() => {
    if (!gameRef.current) {
      return;
    }

    if (gameplayPaused) {
      gameRef.current.scene.pause("TeaShopScene");
      return;
    }

    gameRef.current.scene.resume("TeaShopScene");
  }, [gameplayPaused]);

  useEffect(() => {
    if (dialogue.isActive) {
      wasDialogueActiveRef.current = true;
      return;
    }

    if (wasDialogueActiveRef.current) {
      setShowCredits(true);
    }
  }, [dialogue.isActive]);

  return (
    <main className="shell">
      <section className="gameFrame" aria-label="Boba House 2D 像素风游戏">
        <div className="gameViewport">
          <div ref={mountRef} className="gameMount" />
        </div>

        <aside className="hudPanel" aria-live="polite">
          <div className="brandBlock">
            <span className="eyebrow">Pixel Tea Shop</span>
            <h1>Boba Block</h1>
            <p>从奶茶店出门，沿街去外卖驿站、便利店和社区诊所转一圈。</p>
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
      {!showCredits ? (
        <PauseOverlay
          paused={paused}
          muted={muted}
          onPause={() => setPaused(true)}
          onResume={() => setPaused(false)}
          onBackToMenu={() => {
            setPaused(false);
            onBackToMenu?.();
          }}
          onToggleMute={() => setMuted((prev) => !prev)}
        />
      ) : null}
      {dialogue.isActive && dialogue.currentNode ? (
        <DialogueBox
          speaker={dialogue.currentNode.speaker}
          text={dialogue.currentNode.text}
          choices={dialogue.currentNode.choices}
          onNext={dialogue.goNext}
          onChoose={dialogue.choose}
        />
      ) : null}
      {showCredits ? (
        <EndingCredits
          onBackToMenu={() => {
            setShowCredits(false);
            onBackToMenu?.();
          }}
        />
      ) : null}
    </main>
  );
}
