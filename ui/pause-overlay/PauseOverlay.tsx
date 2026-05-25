"use client";

import pauseIcon from "@/assets/UI/Textures/icons/256x256/pause.png";
import playIcon from "@/assets/UI/Textures/icons/256x256/play.png";
import menuIcon from "@/assets/UI/Textures/icons/256x256/menu.png";
import speakerIcon from "@/assets/UI/Textures/icons/256x256/speaker.png";
import crossIcon from "@/assets/UI/Textures/controls/cross_03.png";
import styles from "./PauseOverlay.module.css";

type PauseOverlayProps = {
  paused: boolean;
  muted: boolean;
  onPause: () => void;
  onResume: () => void;
  onBackToMenu: () => void;
  onToggleMute: () => void;
};

export function PauseOverlay({
  paused,
  muted,
  onPause,
  onResume,
  onBackToMenu,
  onToggleMute,
}: PauseOverlayProps) {
  return (
    <>
      <button type="button" className={styles.pauseTrigger} onClick={onPause} aria-label="暂停游戏">
        <img src={pauseIcon.src} alt="" />
      </button>

      {paused ? (
        <>
          <div className={styles.backdrop} />
          <section className={styles.panel} aria-label="暂停菜单">
            <h2 className={styles.panelTitle}>暂停</h2>

            <button type="button" className={styles.actionBtn} onClick={onResume}>
              <img src={playIcon.src} alt="" />
              <span>继续游戏</span>
            </button>

            <button type="button" className={styles.actionBtn} onClick={onBackToMenu}>
              <img src={menuIcon.src} alt="" />
              <span>返回主菜单</span>
            </button>

            <button type="button" className={styles.actionBtn} onClick={onToggleMute}>
              <span className={styles.soundIconWrap}>
                <img src={speakerIcon.src} alt="" />
                {muted ? <img src={crossIcon.src} alt="" className={styles.muteCross} /> : null}
              </span>
              <span>音量</span>
            </button>
          </section>
        </>
      ) : null}
    </>
  );
}
