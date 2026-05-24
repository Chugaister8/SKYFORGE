"use client";
import { useEffect, useState } from "react";

export function SystemTime() {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toUTCString().split(" ")[4] + " UTC"
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="font-mono text-xs text-text-secondary tabular-nums">
      {time}
    </span>
  );
}
