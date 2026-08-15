import {
  GOAL_LEFT,
  GOAL_LINE_Y,
  GOAL_RIGHT,
  KEEPER_WIDTH,
  PITCH_H,
  PITCH_W,
  SHOOTER_X,
  SHOOTER_Y,
  newGame,
  shoot,
  update,
} from "./game.js";
import { GoalAudio } from "./audio.js";

const BEST_KEY = "pg-goalshot-best";
const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const audio = new GoalAudio();
const els = {
  score: document.querySelector("#score"),
  combo: document.querySelector("#combo"),
  time: document.querySelector("#time"),
  best: document.querySelector("#best"),
  status: document.querySelector("#status"),
  start: document.querySelector("#start"),
  mute: document.querySelector("#mute"),
  power: document.querySelector("#power-fill"),
};

const ballImage = new Image();
ballImage.src = "./assets/art/ball_soccer1.png";

let state = newGame();
let running = false;
let best = 0;
let lastTime = 0;
let frame = 0;
let drag = null;
let previewAim = 0;
let previewPower = 0.7;

function setStatus(message, tone = "") {
  els.status.textContent = message;
  els.status.dataset.tone = tone;
}

function syncHud() {
  els.score.textContent = String(state.score).padStart(4, "0");
  els.combo.textContent = `×${state.combo}`;
  els.time.textContent = String(Math.ceil(state.timeLeft));
  els.best.textContent = String(best);
  els.power.style.height = `${previewPower * 100}%`;
}

function startGame() {
  void audio.unlock();
  audio.tap();
  cancelAnimationFrame(frame);
  state = newGame();
  running = true;
  drag = null;
  previewAim = 0;
  previewPower = 0.7;
  lastTime = performance.now();
  els.start.textContent = "重新開始";
  setStatus("看準門將空檔，拖向遠角射門！");
  syncHud();
  render();
  frame = requestAnimationFrame(tick);
}

function tick(now) {
  if (!running) return;
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  const events = update(state, dt);
  for (const event of events) {
    if (event.type === "goal") {
      audio.goal(event.combo);
      setStatus(`破網！${event.points} 分，連進 ${event.combo} 球`, "good");
    } else if (event.type === "save") {
      audio.save();
      setStatus("被門將撲出！換個角度", "bad");
    } else if (event.type === "miss") {
      audio.save();
      setStatus("射偏了！連段重新累積", "bad");
    } else if (event.type === "end") {
      finishGame();
    }
  }
  syncHud();
  render();
  if (running) frame = requestAnimationFrame(tick);
}

function finishGame() {
  running = false;
  drag = null;
  audio.end();
  setStatus(`終場！踢進 ${state.goals} 球，得到 ${state.score} 分`, "good");
  els.start.textContent = "再踢一局";
  if (state.score > best) {
    best = state.score;
    void saveBest();
  }
}

function attemptShot() {
  if (!running || state.ball) return;
  if (shoot(state, previewAim, previewPower)) {
    audio.kick();
    setStatus(Math.abs(previewAim) > 0.7 ? "攻遠角！" : "正面勁射！");
  }
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * PITCH_W / rect.width,
    y: (event.clientY - rect.top) * PITCH_H / rect.height,
  };
}

canvas.addEventListener("pointerdown", (event) => {
  if (!running || state.ball) return;
  drag = pointerPosition(event);
  previewAim = Math.max(-1, Math.min(1, (drag.x - PITCH_W / 2) / (PITCH_W * 0.38)));
  previewPower = 0.45;
  canvas.setPointerCapture(event.pointerId);
  syncHud();
});

canvas.addEventListener("pointermove", (event) => {
  if (!drag) return;
  const point = pointerPosition(event);
  previewAim = Math.max(-1, Math.min(1, (point.x - PITCH_W / 2) / (PITCH_W * 0.38)));
  previewPower = Math.max(0.45, Math.min(1, Math.hypot(point.x - drag.x, point.y - drag.y) / 180));
  syncHud();
  render();
});

canvas.addEventListener("pointerup", (event) => {
  if (!drag) return;
  const point = pointerPosition(event);
  if (Math.hypot(point.x - drag.x, point.y - drag.y) < 12) previewPower = 0.7;
  drag = null;
  attemptShot();
});
canvas.addEventListener("pointercancel", () => { drag = null; });

els.start.addEventListener("click", startGame);
els.mute.addEventListener("click", () => {
  audio.setEnabled(!audio.enabled);
  els.mute.setAttribute("aria-pressed", String(!audio.enabled));
  els.mute.textContent = audio.enabled ? "音效開" : "已靜音";
  if (audio.enabled) {
    void audio.unlock();
    audio.tap();
  }
});

window.addEventListener("keydown", (event) => {
  if (!running) return;
  if (event.key === "ArrowLeft") previewAim = Math.max(-1, previewAim - 0.1);
  else if (event.key === "ArrowRight") previewAim = Math.min(1, previewAim + 0.1);
  else if (event.key === "ArrowUp") previewPower = Math.min(1, previewPower + 0.05);
  else if (event.key === "ArrowDown") previewPower = Math.max(0, previewPower - 0.05);
  else if (event.key === " " || event.key === "Enter") attemptShot();
  else return;
  event.preventDefault();
  syncHud();
  render();
});

function render() {
  ctx.clearRect(0, 0, PITCH_W, PITCH_H);
  drawPitch();
  drawGoal();
  drawKeeper();
  if (running && !state.ball) drawGuide();
  drawBall(state.ball ?? { x: SHOOTER_X, y: SHOOTER_Y, rotation: 0 });
  if (!running) drawCurtain();
}

function drawPitch() {
  const grass = ctx.createLinearGradient(0, 0, 0, PITCH_H);
  grass.addColorStop(0, "#0a6035");
  grass.addColorStop(1, "#2da64f");
  ctx.fillStyle = grass;
  ctx.fillRect(0, 0, PITCH_W, PITCH_H);
  for (let y = 0; y < PITCH_H; y += 64) {
    ctx.fillStyle = y % 128 === 0 ? "rgba(255,255,255,.035)" : "rgba(0,0,0,.035)";
    ctx.fillRect(0, y, PITCH_W, 64);
  }
  ctx.strokeStyle = "rgba(241,255,237,.78)";
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 55, PITCH_W - 56, 190);
  ctx.beginPath();
  ctx.arc(PITCH_W / 2, 285, 66, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(PITCH_W / 2, 280);
  ctx.lineTo(PITCH_W / 2, PITCH_H);
  ctx.stroke();
}

function drawGoal() {
  ctx.fillStyle = "rgba(220,245,245,.15)";
  ctx.fillRect(GOAL_LEFT, 42, GOAL_RIGHT - GOAL_LEFT, GOAL_LINE_Y - 42);
  ctx.strokeStyle = "rgba(240,255,255,.36)";
  ctx.lineWidth = 1;
  for (let x = GOAL_LEFT + 12; x < GOAL_RIGHT; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, 42);
    ctx.lineTo(x, GOAL_LINE_Y);
    ctx.stroke();
  }
  for (let y = 52; y < GOAL_LINE_Y; y += 14) {
    ctx.beginPath();
    ctx.moveTo(GOAL_LEFT, y);
    ctx.lineTo(GOAL_RIGHT, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#f7ffff";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(GOAL_LEFT, GOAL_LINE_Y);
  ctx.lineTo(GOAL_LEFT, 40);
  ctx.lineTo(GOAL_RIGHT, 40);
  ctx.lineTo(GOAL_RIGHT, GOAL_LINE_Y);
  ctx.stroke();
}

function drawKeeper() {
  const keeper = state.keeper;
  ctx.save();
  ctx.translate(keeper.x, GOAL_LINE_Y - 13);
  ctx.fillStyle = "#ffda3d";
  ctx.fillRect(-KEEPER_WIDTH / 2, -9, KEEPER_WIDTH, 14);
  ctx.fillStyle = "#153b9e";
  ctx.fillRect(-15, -30, 30, 35);
  ctx.fillStyle = "#f1b98b";
  ctx.beginPath();
  ctx.arc(0, -38, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGuide() {
  const targetX = GOAL_LEFT + 14 + (GOAL_RIGHT - GOAL_LEFT - 28) * ((previewAim + 1) / 2);
  ctx.strokeStyle = "rgba(215,255,88,.7)";
  ctx.lineWidth = 3;
  ctx.setLineDash([7, 9]);
  ctx.beginPath();
  ctx.moveTo(SHOOTER_X, SHOOTER_Y);
  ctx.lineTo(targetX, GOAL_LINE_Y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(215,255,88,.18)";
  ctx.beginPath();
  ctx.arc(targetX, GOAL_LINE_Y - 10, 24, 0, Math.PI * 2);
  ctx.fill();
}

function drawBall(ball) {
  const progress = Math.max(0, Math.min(1, (ball.y - GOAL_LINE_Y) / (SHOOTER_Y - GOAL_LINE_Y)));
  const radius = 9 + progress * 12;
  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.rotate(ball.rotation);
  if (ballImage.complete && ballImage.naturalWidth) {
    ctx.drawImage(ballImage, -radius, -radius, radius * 2, radius * 2);
  } else {
    ctx.fillStyle = "#f7f7f7";
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawCurtain() {
  ctx.fillStyle = "rgba(2,27,18,.48)";
  ctx.fillRect(0, 0, PITCH_W, PITCH_H);
  ctx.fillStyle = "#d7ff58";
  ctx.textAlign = "center";
  ctx.font = "900 24px system-ui";
  ctx.fillText("準備開球", PITCH_W / 2, PITCH_H / 2);
}

async function loadBest() {
  try {
    const response = await fetch(`/api/kv/${BEST_KEY}`);
    if (response.ok) {
      const value = (await response.text()).trim();
      if (/^\d+$/.test(value)) best = Number(value);
    }
  } catch {
    // 離線或宿主未提供 KV 時，僅顯示本次工作階段的紀錄。
  }
  syncHud();
}

async function saveBest() {
  syncHud();
  try {
    await fetch(`/api/kv/${BEST_KEY}`, { method: "PUT", body: String(best) });
  } catch {
    // KV 暫時不可用不影響遊戲。
  }
}

syncHud();
render();
void loadBest();
