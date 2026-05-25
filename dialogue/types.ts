export type DialogueChoice = {
  label: string;
  next: string;
};

export type DialogueNode = {
  speaker: string;
  text: string;
  next?: string;
  choices?: DialogueChoice[];
  end?: boolean;
};

export type DialogueTree = {
  start: string;
  nodes: Record<string, DialogueNode>;
};
