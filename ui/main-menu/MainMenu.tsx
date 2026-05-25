"use client";

import mainMenuImage from "@/assets/UI/Textures/mai.jpg";
import "./main-menu.css";

type MainMenuProps = {
  onStart: () => void;
};

export function MainMenu({ onStart }: MainMenuProps) {
  return (
    <main className="mainMenuRoot">
      <section className="mainMenuStage" aria-label="游戏主菜单">
        <img className="mainMenuImage" src={mainMenuImage.src} alt="一线一天 AI 一线职业体验模拟器" />
        <button type="button" className="mainMenuStartBtn" onClick={onStart}>
          开始游戏
        </button>
      </section>
    </main>
  );
}
