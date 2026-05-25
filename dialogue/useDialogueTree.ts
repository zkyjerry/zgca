"use client";

import { useMemo, useState } from "react";
import type { DialogueTree } from "@/dialogue/types";

export function useDialogueTree(tree: DialogueTree) {
  const [currentId, setCurrentId] = useState<string | null>(() => {
    return tree.nodes[tree.start] ? tree.start : null;
  });

  const currentNode = useMemo(() => {
    if (!currentId) {
      return null;
    }

    return tree.nodes[currentId] ?? null;
  }, [currentId, tree.nodes]);

  const hasChoices = Boolean(currentNode?.choices && currentNode.choices.length > 0);
  const isActive = Boolean(currentNode);

  const endDialogue = () => {
    setCurrentId(null);
  };

  const goNext = () => {
    if (!currentNode) {
      return;
    }

    if (currentNode.end) {
      endDialogue();
      return;
    }

    if (hasChoices) {
      return;
    }

    if (!currentNode.next) {
      endDialogue();
      return;
    }

    const nextNode = tree.nodes[currentNode.next];

    if (!nextNode) {
      endDialogue();
      return;
    }

    setCurrentId(currentNode.next);
  };

  const choose = (nextId: string) => {
    const nextNode = tree.nodes[nextId];

    if (!nextNode) {
      endDialogue();
      return;
    }

    setCurrentId(nextId);
  };

  const restart = () => {
    setCurrentId(tree.nodes[tree.start] ? tree.start : null);
  };

  return {
    isActive,
    currentNode,
    hasChoices,
    goNext,
    choose,
    endDialogue,
    restart,
  };
}
