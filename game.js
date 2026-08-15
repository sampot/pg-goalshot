/**
 * 射門機純遊戲邏輯。座標以 360 × 520 的直式球場計算，不依賴 DOM。
 */
export const PITCH_W = 360;
export const PITCH_H = 520;
export const GOAL_LINE_Y = 112;
export const GOAL_LEFT = 58;
export const GOAL_RIGHT = 302;
export const SHOOTER_X = PITCH_W / 2;
export const SHOOTER_Y = 450;
export const KEEPER_WIDTH = 58;
export const ROUND_SECONDS = 40;

const BASE_POINTS = 10;
const MAX_MULTIPLIER = 5;

export function newGame({ durationSec = ROUND_SECONDS } = {}) {
  const timeLeft = Math.max(1, Number.isFinite(durationSec) ? durationSec : ROUND_SECONDS);
  return {
    score: 0,
    combo: 0,
    shots: 0,
    goals: 0,
    timeLeft,
    durationSec: timeLeft,
    phase: "playing",
    ball: null,
    keeper: {
      x: PITCH_W / 2,
      vx: 92,
    },
    lastResult: "",
  };
}

/**
 * aim 為 -1..1（左角至右角），power 為 0..1。
 */
export function shoot(state, aim, power) {
  if (state.phase !== "playing" || state.ball) return false;

  const safeAim = clamp(Number.isFinite(aim) ? aim : 0, -1, 1);
  const safePower = clamp(Number.isFinite(power) ? power : 0.5, 0, 1);
  const targetX = lerp(GOAL_LEFT + 14, GOAL_RIGHT - 14, (safeAim + 1) / 2);
  const speedY = 310 + safePower * 250;
  const travelTime = (SHOOTER_Y - GOAL_LINE_Y) / speedY;

  state.ball = {
    x: SHOOTER_X,
    y: SHOOTER_Y,
    prevY: SHOOTER_Y,
    vx: (targetX - SHOOTER_X) / travelTime,
    vy: -speedY,
    aim: safeAim,
    power: safePower,
    rotation: 0,
  };
  state.shots += 1;
  state.lastResult = "";
  return true;
}

/**
 * 推進 dt 秒並回傳 goal、save、miss、end 事件。
 */
export function update(state, dt) {
  const events = [];
  const safeDt = Math.max(0, Number.isFinite(dt) ? dt : 0);

  if (state.phase === "playing") {
    state.timeLeft = Math.max(0, state.timeLeft - safeDt);
    if (state.timeLeft === 0) {
      state.phase = "over";
      state.ball = null;
      events.push({ type: "end", score: state.score });
      return events;
    }
  }

  let remaining = safeDt;
  while (remaining > 0) {
    const step = Math.min(1 / 120, remaining);
    moveKeeper(state, step);
    if (state.ball) advanceBall(state, step, events);
    remaining -= step;
  }
  return events;
}

function moveKeeper(state, dt) {
  const keeper = state.keeper;
  keeper.x += keeper.vx * dt;
  const half = KEEPER_WIDTH / 2;
  if (keeper.x - half < GOAL_LEFT) {
    keeper.x = GOAL_LEFT + half;
    keeper.vx = Math.abs(keeper.vx);
  } else if (keeper.x + half > GOAL_RIGHT) {
    keeper.x = GOAL_RIGHT - half;
    keeper.vx = -Math.abs(keeper.vx);
  }
}

function advanceBall(state, dt, events) {
  const ball = state.ball;
  ball.prevY = ball.y;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.rotation += ball.vx * dt * 0.02;

  const crossedGoalLine = ball.prevY > GOAL_LINE_Y && ball.y <= GOAL_LINE_Y;
  if (crossedGoalLine) {
    if (ball.x < GOAL_LEFT || ball.x > GOAL_RIGHT) {
      registerFailure(state, events, "miss");
      return;
    }
    if (Math.abs(ball.x - state.keeper.x) <= KEEPER_WIDTH / 2 + 10) {
      registerFailure(state, events, "save");
      return;
    }
    registerGoal(state, events);
    return;
  }

  if (ball.x < -24 || ball.x > PITCH_W + 24 || ball.y < -24 || ball.y > PITCH_H + 24) {
    registerFailure(state, events, "miss");
  }
}

function registerGoal(state, events) {
  state.combo += 1;
  state.goals += 1;
  const multiplier = Math.min(state.combo, MAX_MULTIPLIER);
  const points = BASE_POINTS * multiplier;
  state.score += points;
  state.lastResult = `+${points}`;
  state.ball = null;
  events.push({ type: "goal", points, combo: state.combo });
}

function registerFailure(state, events, type) {
  state.combo = 0;
  state.lastResult = type === "save" ? "撲出" : "射偏";
  state.ball = null;
  events.push({ type });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}
