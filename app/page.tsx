"use client";

import { useState } from "react";
import TeaShopGame from "@/components/TeaShopGame";
import { MainMenu } from "@/ui/main-menu";

export default function Home() {
  const [started, setStarted] = useState(false);

  if (!started) {
    return <MainMenu onStart={() => setStarted(true)} />;
  }

  return <TeaShopGame onBackToMenu={() => setStarted(false)} />;
}
