import { describe, expect, it } from "vitest";
import {
  GOAL_LEFT,
  GOAL_LINE_Y,
  GOAL_RIGHT,
  PITCH_H,
  newGame,
  shoot,
  update,
} from "./game.js";

function advanceUntilSettled(state, limit = 3) {
  const events = [];
  for (let elapsed = 0; state.ball && elapsed < limit; elapsed += 1 / 120) {
    events.push(...update(state, 1 / 120));
  }
  return events;
}

describe("射門機新局", () => {
  it("預設建立 40 秒、零分且守門員移動中的球局", () => {
    const state = newGame();
    expect(state).toMatchObject({
      score: 0,
      combo: 0,
      shots: 0,
      goals: 0,
      timeLeft: 40,
      phase: "playing",
      ball: null,
    });
    expect(state.keeper.x).toBeGreaterThan(GOAL_LEFT);
    expect(state.keeper.vx).not.toBe(0);
  });

  it("可指定局時，且至少為一秒", () => {
    expect(newGame({ durationSec: 25 }).timeLeft).toBe(25);
    expect(newGame({ durationSec: 0 }).timeLeft).toBe(1);
  });
});

describe("射門", () => {
  it("限制左右準星與力道，場上一次只有一球", () => {
    const state = newGame();
    expect(shoot(state, 9, -1)).toBe(true);
    expect(state.ball.aim).toBe(1);
    expect(state.ball.power).toBe(0);
    expect(state.shots).toBe(1);
    expect(shoot(state, 0, 1)).toBe(false);
  });

  it("合理力道會讓球朝球門線前進", () => {
    const state = newGame();
    shoot(state, 0.8, 0.7);
    const beforeY = state.ball.y;
    update(state, 0.05);
    expect(state.ball.y).toBeLessThan(beforeY);
    expect(state.ball.x).toBeGreaterThan(180);
  });
});

describe("進球與守門", () => {
  it("球越過門線且在門柱內、避開門將時進球", () => {
    const state = newGame();
    state.keeper.x = GOAL_LEFT + 25;
    state.keeper.vx = 0;
    state.ball = {
      x: GOAL_RIGHT - 20,
      y: GOAL_LINE_Y + 2,
      prevY: GOAL_LINE_Y + 2,
      vx: 0,
      vy: -180,
      power: 0.8,
      aim: 1,
      rotation: 0,
    };
    const events = update(state, 0.03);
    expect(events.some((event) => event.type === "goal")).toBe(true);
    expect(state).toMatchObject({ goals: 1, combo: 1, score: 10, ball: null });
  });

  it("射正但撞上門將時被撲救，連段歸零", () => {
    const state = newGame();
    state.combo = 3;
    state.keeper.x = 180;
    state.keeper.vx = 0;
    state.ball = {
      x: 180,
      y: GOAL_LINE_Y + 2,
      prevY: GOAL_LINE_Y + 2,
      vx: 0,
      vy: -180,
      power: 0.8,
      aim: 0,
      rotation: 0,
    };
    const events = update(state, 0.03);
    expect(events.some((event) => event.type === "save")).toBe(true);
    expect(state.combo).toBe(0);
  });

  it("射出門柱外算失手", () => {
    const state = newGame();
    state.ball = {
      x: GOAL_RIGHT + 10,
      y: GOAL_LINE_Y + 2,
      prevY: GOAL_LINE_Y + 2,
      vx: 0,
      vy: -180,
      power: 0.8,
      aim: 1,
      rotation: 0,
    };
    const events = update(state, 0.03);
    expect(events.some((event) => event.type === "miss")).toBe(true);
  });

  it("瞄準遠角可避開停在中央的門將", () => {
    const state = newGame();
    state.keeper.x = 180;
    state.keeper.vx = 0;
    shoot(state, 0.9, 0.75);
    const events = advanceUntilSettled(state);
    expect(events.some((event) => event.type === "goal")).toBe(true);
  });
});

describe("球出界與時間到", () => {
  it("球離開球場會判失手", () => {
    const state = newGame();
    state.ball = {
      x: -30,
      y: PITCH_H / 2,
      prevY: PITCH_H / 2,
      vx: -100,
      vy: 0,
      power: 1,
      aim: -1,
      rotation: 0,
    };
    expect(update(state, 0.02).some((event) => event.type === "miss")).toBe(true);
  });

  it("倒數結束後不能再射門", () => {
    const state = newGame({ durationSec: 1 });
    const events = update(state, 1.1);
    expect(state.timeLeft).toBe(0);
    expect(state.phase).toBe("over");
    expect(events.some((event) => event.type === "end")).toBe(true);
    expect(shoot(state, 0, 0.8)).toBe(false);
  });
});
