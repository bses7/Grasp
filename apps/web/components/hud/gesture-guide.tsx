"use client";

/**
 * Controls guide, bottom right (doc 11 "Controls strip"): one tile per control, and in the gesture condition the
 * tile for what the hand is doing now lights up, driven by the same HandState as the hand-state chip.
 * Both conditions show the same four actions (study parity); `extras` adds the dev-only controls (extra gestures, zoom, explode); study sessions never list them.
 */
import type { ReactNode } from "react";
import type { HandState } from "./cv-status";

type Tile = {
  glyph: string;
  verb: string;
  how: string;
  on?: readonly HandState[];
};

const GESTURE: readonly Tile[] = [
  { glyph: "☝", verb: "Pick", how: "point and hold", on: ["HOVER"] },
  {
    glyph: "🤏",
    verb: "Grab",
    how: "pinch a part",
    on: ["GRABBING", "DRAGGING"],
  },
  { glyph: "🤏", verb: "Turn", how: "pinch empty space", on: ["ORBIT"] },
  { glyph: "✋", verb: "Let go", how: "open your hand", on: ["IDLE"] },
];
const GESTURE_EXTRA: readonly Tile[] = [
  { glyph: "✊", verb: "Spin", how: "make a fist, move", on: ["FIST"] },
  { glyph: "🙌", verb: "Zoom", how: "pinch both on heart", on: ["ZOOM"] },
  {
    glyph: "↔",
    verb: "Explode",
    how: "pinch both off heart, pull",
    on: ["EXPLODE"],
  },
  { glyph: "⟳", verb: "Roll", how: "twist both pinches", on: ["ROLL"] },
];
const MOUSE: readonly Tile[] = [
  { glyph: "Click", verb: "Select", how: "a part or marker" },
  { glyph: "Drag", verb: "Move", how: "a part" },
  { glyph: "Drag", verb: "Turn", how: "empty space or arrows" },
  { glyph: "Release", verb: "Let go", how: "the mouse button" },
];
const MOUSE_EXTRA: readonly Tile[] = [
  { glyph: "Wheel", verb: "Zoom", how: "or + and −" },
  { glyph: "X", verb: "Explode", how: "and back" },
];

export function GestureGuide({
  input,
  hand,
  extras,
  children,
}: {
  input: "gesture" | "mouse";
  hand: HandState;
  extras: boolean;
  children?: ReactNode;
}) {
  const gesture = input === "gesture";
  const groups: [string, readonly Tile[]][] = [
    [gesture ? "Gestures" : "Controls", gesture ? GESTURE : MOUSE],
  ];
  if (extras)
    groups.push(["Extras (dev)", gesture ? GESTURE_EXTRA : MOUSE_EXTRA]);
  return (
    <aside
      aria-label="Controls"
      className="card absolute right-4 bottom-4 max-w-[calc(100%-2rem)] p-2 text-text"
    >
      <div className="flex">
        {groups.map(([title, tiles]) => (
          <section
            key={title}
            className="w-[228px] [&+&]:ml-1 [&+&]:border-l [&+&]:border-surface-edge [&+&]:pl-1"
          >
            <h2 className="px-2 pt-0.5 pb-0.5 text-[11px] font-semibold tracking-wider text-text-muted uppercase">
              {title}
            </h2>
            <ul>
              {tiles.map((t) => {
                const active = gesture && !!t.on?.includes(hand);
                return (
                  <li
                    key={t.verb}
                    aria-current={active || undefined}
                    className={`flex items-center gap-2.5 rounded-xl px-2 py-0.5 transition-colors duration-150 ${active ? "bg-accent text-accent-ink" : ""}`}
                  >
                    <span
                      aria-hidden
                      className={`grid h-7 w-11 shrink-0 place-items-center rounded-lg leading-none ${
                        gesture
                          ? "text-lg"
                          : `border px-1 text-[11px] font-semibold ${active ? "border-accent-ink" : "border-track bg-bg"}`
                      }`}
                    >
                      {t.glyph}
                    </span>
                    <span className="min-w-0 leading-tight">
                      <span className="block font-display text-sm font-bold">
                        {t.verb}
                      </span>
                      <span
                        className={`block text-xs ${active ? "text-accent-ink" : "text-text-muted"}`}
                      >
                        {t.how}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      {children && (
        <div className="mt-1 border-t border-surface-edge px-2 pt-1.5 pb-0.5 text-sm">
          {children}
        </div>
      )}
    </aside>
  );
}
