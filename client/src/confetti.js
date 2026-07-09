// Lightweight, dependency-free confetti burst — plain DOM nodes animated
// with CSS (see .confetti-* in index.css), appended to <body> and cleaned up
// automatically. No canvas, no external library.

const COLORS = ["#c8102e", "#3a6ea5", "#4a8c5f", "#c98a2b", "#ef5d6b"];

export function fireConfetti({ count = 40, originY = 0.25 } = {}) {
  if (typeof document === "undefined") return;
  const container = document.createElement("div");
  container.className = "confetti-container";
  document.body.appendChild(container);

  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    const drift = (Math.random() - 0.5) * 240;
    const rotate = Math.random() * 720 - 360;
    const duration = 1.3 + Math.random() * 1.1;
    const delay = Math.random() * 0.25;
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.top = `${originY * 100}vh`;
    piece.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
    piece.style.setProperty("--drift", `${drift}px`);
    piece.style.setProperty("--rotate", `${rotate}deg`);
    piece.style.animationDuration = `${duration}s`;
    piece.style.animationDelay = `${delay}s`;
    container.appendChild(piece);
  }

  setTimeout(() => container.remove(), 3000);
}
