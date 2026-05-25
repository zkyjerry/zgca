"use client";

import { useState } from "react";
import styles from "./EndingCredits.module.css";

type EndingCreditsProps = {
  onBackToMenu?: () => void;
};

export function EndingCredits({ onBackToMenu }: EndingCreditsProps) {
  const [finished, setFinished] = useState(false);

  return (
    <section className={styles.overlay} aria-label="这一天之后">
      <div className={styles.fadeTop} />
      <div className={styles.fadeBottom} />

      <div className={styles.roll} onAnimationEnd={() => setFinished(true)}>
        <h1 className={styles.title}>这一天之后</h1>

        <p className={styles.paragraph}>今天，你体验了一名奶茶店店员的一天。</p>
        <p className={styles.paragraph}>你听见小票机不停响起，看见订单一张张堆上来，也感受到被催促时的紧张。</p>
        <p className={styles.paragraph}>一杯奶茶背后，不只是配方和动作。</p>
        <p className={styles.paragraph}>还有确认、制作、核对、出杯；还有久站的疲惫，来不及喝水的忙乱，以及面对误解时仍要保持耐心的努力。</p>
        <p className={styles.paragraph}>顾客会着急，骑手会焦虑，店员也会疲惫。</p>
        <p className={styles.paragraph}>每个人都有自己的压力，也都希望被理解。</p>
        <p className={styles.paragraph}>理解不是要求谁一味忍耐，而是在开口之前，多想一想对方正在经历什么。</p>
        <p className={styles.paragraph}>下一次等待时，也许我们可以多一点耐心。</p>
        <p className={styles.paragraph}>下一次接受服务时，也许可以说一句：</p>
        <p className={styles.strongLine}>辛苦了。</p>
        <p className={styles.paragraph}>一线一天，愿我们看见劳动，也看见劳动者。</p>
      </div>

      {finished ? (
        <div className={styles.footer}>
          <button type="button" className={styles.backButton} onClick={onBackToMenu}>
            返回主菜单
          </button>
        </div>
      ) : null}
    </section>
  );
}
