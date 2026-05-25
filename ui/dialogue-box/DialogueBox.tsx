"use client";

import type { DialogueChoice } from "@/dialogue/types";
import styles from "./DialogueBox.module.css";

type DialogueBoxProps = {
  speaker: string;
  text: string;
  choices?: DialogueChoice[];
  onNext: () => void;
  onChoose: (nextId: string) => void;
};

export function DialogueBox({ speaker, text, choices, onNext, onChoose }: DialogueBoxProps) {
  const hasChoices = Boolean(choices && choices.length > 0);

  return (
    <section className={styles.overlay} aria-live="polite" aria-label="剧情对话">
      <div className={styles.panel}>
        <button type="button" className={styles.textArea} onClick={onNext} disabled={hasChoices}>
          <p className={styles.speaker}>{speaker || " "}</p>
          <p className={styles.content}>{text}</p>
          {!hasChoices ? <p className={styles.hint}>点击继续</p> : null}
        </button>

        {hasChoices ? (
          <div className={styles.choices} role="group" aria-label="剧情选项">
            {choices!.map((choice) => (
              <button key={`${choice.label}-${choice.next}`} type="button" className={styles.choiceBtn} onClick={() => onChoose(choice.next)}>
                {choice.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
