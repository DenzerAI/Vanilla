import { iconPathLengths as PATH_LENGTHS } from "./icon-catalog.mjs";
// Shape-level SVG timelines. Quintic ramps and sine-squared envelopes have zero endpoint velocity.
// No runtime dependency, randomized motion, style injection or continuous idle loops.
const NS = "http://www.w3.org/2000/svg";
const clamp = (x) => Math.max(0, Math.min(1, x));
const S = (x) => {
  x = clamp(x);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const ramp = (t, a = 0, b = 1) => S((t - a) / (b - a));
const B = (t, a = 0, b = 1) => {
  let u = clamp((t - a) / (b - a));
  return Math.sin(Math.PI * u) ** 2;
};
const win = (t, a = 0.1, b = 0.25, c = 0.72, d = 0.94) =>
  ramp(t, a, b) * (1 - ramp(t, c, d));
const num = (x) => Number(x.toFixed(5));
const set = (el, k, v) =>
  el.setAttribute(k, typeof v === "number" ? num(v) : v);
const tr = (el, x = 0, y = 0, a = 0, cx = 28, cy = 28, sx = 1, sy = sx) =>
  set(
    el,
    "transform",
    `translate(${num(x)} ${num(y)}) translate(${cx} ${cy}) rotate(${num(a)}) scale(${num(sx)} ${num(sy)}) translate(${-cx} ${-cy})`,
  );
const op = (el, v) => set(el, "opacity", clamp(v));
function element(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) set(el, k, v);
  return el;
}
let serial = 0;
export function createIcon(item, { confirmation = false } = {}) {
  const svg = element("svg", {
    viewBox: "-8 -8 72 72",
    fill: "currentColor",
    "aria-hidden": "true",
    focusable: "false",
    class: "motion-icon",
    "data-icon": item.name,
  });
  const defs = element("defs");
  svg.append(defs);
  const root = element("g");
  svg.append(root);
  const parts = [];
  if (item.kind === "lucide") {
    const g = element("g", {
      transform: "scale(2.333333)",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": item.motion === "Sun" || item.motion === "Moon" ? 1.5 : 2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    });
    g.innerHTML = item.markup;
    root.append(g);
    parts.push(...g.children);
  } else if (item.kind === "layout") {
    const g = element("g", {
      transform: "translate(0 4.666667) scale(2.333333)",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 1.5,
    });
    root.append(g);
    g.append(element("rect", { x: 2, y: 2, width: 20, height: 16, rx: 2 }));
    for (let j = 1; j < item.count; j++)
      g.append(
        element("path", {
          d: `M ${2 + (20 * j) / item.count} 2 L ${2 + (20 * j) / item.count} 18`,
        }),
      );
    parts.push(...g.children);
  } else
    for (const p of item.groups) {
      const el = element("path", { d: p.d });
      root.append(el);
      parts.push(el);
    }
  const originalSnapshot = root.cloneNode(true);
  const uid = "i" + ++serial;
  const path = (d, attrs = {}, parent = root) => {
    const p = element("path", {
      d,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 3,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      ...attrs,
    });
    parent.append(p);
    return p;
  };
  const trace = (d, width = 8) => {
    const e = draw(d, Math.max(width, 8));
    const id = uid + "trace" + defs.children.length;
    const cp = element("clipPath", { id, clipPathUnits: "userSpaceOnUse" });
    for (const p of parts) cp.append(p.cloneNode(true));
    defs.append(cp);
    set(e, "clip-path", "url(#" + id + ")");
    return e;
  };
  const extra = (tag, attrs = {}) => {
    const e = element(tag, attrs);
    root.append(e);
    return e;
  };
  const draw = (d, width = 3) => {
    const length = PATH_LENGTHS[d];
    if (!length) throw Error("Missing path length: " + d);
    return path(d, {
      "data-length": length,
      "stroke-dasharray": length + " " + length,
      "stroke-dashoffset": length,
      "stroke-width": width,
      opacity: 0,
    });
  };
  const ink = (e, t, a = 0.1, b = 0.72) => {
    op(e, win(t, 0.04, 0.18, 0.78, 1));
    set(
      e,
      "stroke-dashoffset",
      Number(e.getAttribute("data-length")) * (1 - ramp(t, a, b)),
    );
  };
  const reveal = (el, t, a = 0.05, b = 0.65) => {
    op(el, 1 - 0.8 * win(t, 0, 0.14, b, 0.95));
  };
  const slice = (source, rect) => {
    const id = uid + "c" + defs.children.length;
    let clip = element("clipPath", { id, clipPathUnits: "userSpaceOnUse" });
    clip.append(
      element("rect", {
        x: rect[0],
        y: rect[1],
        width: rect[2],
        height: rect[3],
      }),
    );
    defs.append(clip);
    const g = element("g");
    g.append(source.cloneNode(true));
    g.firstChild.setAttribute("clip-path", "url(#" + id + ")");
    root.append(g);
    return g;
  };
  const full = () => {
    const g = element("g");
    for (const p of parts) g.append(p.cloneNode(true));
    return g;
  };
  const warp = (el, source, fn) => {
    set(
      el,
      "d",
      source.replace(/([MLC])([^MLCZ]+)/g, (_, cmd, coords) => {
        const values = coords
          .trim()
          .split(/[\s,]+/)
          .map(Number);
        let out = [];
        for (let j = 0; j < values.length; j += 2)
          out.push(...fn(values[j], values[j + 1]).map(num));
        return cmd + " " + out.join(" ") + " ";
      }),
    );
  };
  let frame;
  if (item.kind === "lucide") {
    if (item.motion === "Wrench")
      frame = (t) => tr(root, 0, 0, -25 * B(t));
    if (item.motion === "RotateCcw")
      frame = (t) => tr(root, 0, 0, -360 * ramp(t));
    if (item.motion === "Moon")
      frame = (t) => tr(root, -2 * B(t), -2 * B(t), -18 * B(t));
    if (item.motion === "Sun")
      frame = (t) => {
        parts.forEach((p, i) =>
          tr(p, 0, 0, i ? 45 * B(t) : 0, 12, 12, 1 + (i ? 0.08 : 0) * B(t)),
        );
      };
    if (item.motion === "Zap")
      frame = (t) => {
        parts.forEach((p) => {
          const length = PATH_LENGTHS[p.getAttribute("d")];
          set(p, "stroke-dasharray", length + " " + length);
          set(p, "stroke-dashoffset", length * 0.85 * B(t, 0, 0.9));
          op(p, 1 - 0.4 * B(t));
        });
      };
  } else if (item.kind === "layout") {
    frame = (t) => {
      if (item.count === 1) tr(root, 0, 0, 0, 28, 28, 1 + 0.07 * B(t), 1);
      else
        parts.slice(1).forEach((p, j) => {
          let b = B(t, j * 0.08, 0.8 + j * 0.06);
          tr(p, 2 * (j % 2 ? 1 : -1) * b, 0, 0, 12, 10, 1, 1 - 0.48 * b);
        });
    };
  } else
    switch (item.name) {
      case "PanelLeft":
      case "PanelRight": {
        const right = item.name === "PanelRight",
          dir = right ? -1 : 1,
          source = item.groups[0].d;
        frame = (t) => {
          const b = B(t);
          warp(parts[0], source, (x, y) => [
            x +
              dir *
                5 *
                b *
                Math.max(0, 1 - Math.abs(x - (right ? 36 : 20)) / 17),
            y,
          ]);
          parts
            .slice(1)
            .forEach((p, i) =>
              tr(p, dir * 3 * B(t, 0.04 + i * 0.07, 0.86 + i * 0.04), 0),
            );
        };
        break;
      }
      case "Maximize":
        frame = (t) => {
          tr(parts[0], -5 * B(t), -5 * B(t));
          tr(parts[1], 5 * B(t), 5 * B(t));
        };
        break;
      case "Minimize":
        frame = (t) => {
          tr(parts[0], 1.2 * B(t), 1.2 * B(t));
          tr(parts[1], -1.2 * B(t), -1.2 * B(t));
        };
        break;
      case "ChevronDown":
        frame = (t) => tr(root, 0, 0, 180 * B(t));
        break;
      case "ChevronRight":
        frame = (t) => tr(root, 0, 0, 90 * B(t));
        break;
      case "ChevronLeft":
        frame = (t) => tr(root, 0, 0, -90 * B(t));
        break;
      case "ArrowLeft":
        frame = (t) => tr(root, -7 * B(t), 0);
        break;
      case "ArrowUp":
        frame = (t) => tr(root, 0, -7 * B(t));
        break;
      case "ArrowUpRight":
        frame = (t) => tr(root, 6 * B(t), -6 * B(t));
        break;
      case "Plus": {
        frame = (t) => {
          let b = B(t);
          tr(root, 0, 0, 90 * B(t), 28, 28, 1 + 0.1 * b);
        };
        break;
      }
      case "Search":
        frame = (t) => {
          let a = Math.PI * 2 * ramp(t),
            b = B(t);
          tr(root, 4 * b * Math.cos(a), 3 * b * Math.sin(a), -9 * b);
        };
        break;
      case "Bell": {
        parts.forEach((p) => p.remove());
        const src = full();
        const bell = slice(src, [-10, -10, 76, 53.75]),
          clapper = slice(src, [-10, 43.75, 76, 22]);
        frame = (t) => {
          let e = B(t) * Math.exp(-1.15 * t),
            angle = 18 * e * Math.sin(5 * Math.PI * t);
          tr(bell, 0, 0, angle, 28, 7);
          tr(clapper, 0, 0, -angle * 0.85, 28, 42);
        };
        break;
      }
      case "Settings":
        frame = (t) => tr(parts[0], 0, 0, 360 * ramp(t), 28, 28);
        break;
      case "SquarePen": {
        const line = draw("M 14 40 C 18 35 19 42 23 38 S 28 39 31 37", 2.3);
        frame = (t) => {
          const b = B(t);
          [parts[0], parts[1]].forEach((p) => tr(p, -7 * b, 5 * b, 0));
          ink(line, t, 0.24, 0.72);
        };
        break;
      }
      case "Clock":
        frame = (t) => tr(parts[1], 0, 0, 360 * ramp(t), 28, 28);
        break;
      case "Plug":
        frame = (t) => {
          let b = B(t);
          tr(parts[0], -3 * b, 3 * b);
          tr(parts[1], 3 * b, -3 * b);
        };
        break;
      case "Link":
        frame = (t) => {
          let b = B(t);
          tr(parts[0], 3.5 * b, -3.5 * b, -5 * b, 34, 22);
          tr(parts[1], -3.5 * b, 3.5 * b, -5 * b, 22, 34);
        };
        break;
      case "Folder":
      case "FolderOpen": {
        let open = item.name === "FolderOpen",
          source = item.groups[0].d;
        let paper = extra("rect", {
          x: 14,
          y: 19,
          width: 28,
          height: 22,
          rx: 2,
          fill: "none",
          stroke: "currentColor",
          "stroke-width": 2.5,
          opacity: 0,
        });
        root.insertBefore(paper, parts[0]);
        const paperClip = element("clipPath", {
          id: uid + "paper",
          clipPathUnits: "userSpaceOnUse",
        });
        paperClip.append(
          element("rect", { x: 0, y: -20, width: 56, height: 38 }),
        );
        defs.append(paperClip);
        const paperWrap = element("g", {
          "clip-path": "url(#" + uid + "paper)",
        });
        paper.before(paperWrap);
        paperWrap.append(paper);
        frame = (t) => {
          const b = B(t);
          warp(parts[0], source, (x, y) => [
            x + (x - 28) * 0.08 * b * clamp((y - 14) / 28),
            y - 5 * b * clamp((y - 14) / 28),
          ]);
          op(paper, open ? 0.65 * B(t, 0.1, 0.94) : 0);
          tr(paper, 0, -11 * b);
        };
        break;
      }
      case "FileText":
        frame = (t) =>
          parts.slice(1).forEach((p, i) => {
            let b = B(t, 0.08 * i, 0.86 + 0.1 * i);
            tr(p, 0, 0, 0, 17.4, 32, 1 - 0.85 * b, 1);
            op(p, 1 - 0.45 * b);
          });
        break;
      case "Terminal": {
        const cursor = draw("M 32 39 H 40", 3);
        frame = (t) => {
          tr(parts[1], 3 * B(t), 0);
          ink(cursor, t, 0.25, 0.5);
        };
        break;
      }
      case "Globe": {
        const source = item.groups[0].d;
        frame = (t) =>
          warp(parts[0], source, (x, y) => {
            let rx = x - 28,
              ry = y - 28,
              inner = clamp((23 - Math.hypot(rx, ry)) / 6);
            return [
              x + 5 * B(t) * inner * Math.cos(((ry / 24) * Math.PI) / 2),
              y,
            ];
          });
        break;
      }
      case "GitBranch": {
        const inkline = trace("M28 46 V32 Q28 24 42 13 L45 10", 7);
        frame = (t) => {
          op(parts[0], 1 - 0.55 * B(t));
          ink(inkline, t, 0.1, 0.8);
        };
        break;
      }
      case "MoreHorizontal":
        frame = (t) =>
          parts.forEach((p, i) =>
            tr(p, 0, -5 * B(t, i * 0.13, 0.6 + i * 0.13)),
          );
        break;
      case "Ellipsis":
        frame = (t) => {
          tr(parts[0], -5 * B(t), 0);
          tr(parts[1], 0, 0, 0, 28, 28, 1 - 0.18 * B(t));
          tr(parts[2], 5 * B(t), 0);
        };
        break;
      case "Command": {
        const line = trace(
          "M 19 19 V 12 C19 3 6 4 7 13 Q7 19 19 19 H37 Q49 19 49 12 C49 4 36 4 36 12 V43 C36 51 49 51 49 43 Q49 36 37 36 H19 Q7 36 7 43 C7 51 19 51 19 43 Z",
          3,
        );
        frame = (t) => {
          op(parts[0], 1 - 0.65 * B(t));
          ink(line, t, 0.1, 0.9);
        };
        break;
      }
      case "Shield": {
        const line = trace(
          "M28 6 Q39 12 45 13 V29 Q44 43 28 49 Q12 43 11 29 V13 Q20 11 28 6",
          3,
        );
        frame = (t) => {
          op(parts[0], 1 - 0.72 * B(t));
          ink(line, t, 0.1, 0.82);
        };
        break;
      }
      case "ShieldCheck":
      case "CheckCircle2":
      case "Check": {
        const standalone = item.name === "Check";
        const checked = standalone ? parts[0] : parts[1];
        const line = trace(
          standalone ? "M 10 29 L23 45 L46 10" : "M18 28 L25 36 L37 19",
          standalone ? 4.2 : 3.4,
        );
        frame = (t) => {
          reveal(checked, t);
          ink(line, t, 0.13, 0.75);
        };
        break;
      }
      case "KeyRound": {
        const source = item.groups[1].d;
        frame = (t) =>
          warp(parts[1], source, (x, y) => [
            x + 3 * B(t) * clamp((23 - y) / 8),
            y - 3 * B(t) * clamp((23 - y) / 8),
          ]);
        break;
      }
      case "Sun":
        frame = (t) =>
          parts.forEach((p, i) => {
            if (i !== 3) {
              let b = B(t, 0.02 * i, 0.83 + 0.02 * i);
              const box = item.groups[i].box,
                cx = (box[0] + box[2]) / 2,
                cy = (box[1] + box[3]) / 2;
              tr(
                p,
                (cx - 28) * 0.11 * b,
                (cy - 28) * 0.11 * b,
                45 * B(t),
                28,
                28,
              );
            }
          });
        break;
      case "Moon":
        frame = (t) => tr(root, -2 * B(t), -2.5 * B(t), -20 * B(t), 28, 28);
        break;
      case "Mic": {
        const wave = path("M 16 25 Q 16 42 28 42 Q40 42 40 25", {
          "stroke-width": 1.5,
          opacity: 0,
        });
        frame = (t) => {
          let b = B(t);
          tr(parts[0], 0, -2 * b, 0, 28, 20, 1, 1 - 0.08 * b);
          op(wave, 0.7 * b);
          tr(wave, 0, 0, 0, 28, 28, 1 + 0.13 * b);
        };
        break;
      }
      case "Square": {
        const source = item.groups[0].d;
        frame = (t) =>
          warp(parts[0], source, (x, y) => [
            28 + (x - 28) * (1 - 0.15 * B(t)),
            28 + (y - 28) * (1 - 0.15 * B(t, 0.06, 0.96)),
          ]);
        break;
      }
      case "Copy": {
        const original = element("g");
        parts.forEach((p) => original.append(p));
        root.append(original);
        const sheets = element("g", { opacity: 0 });
        root.append(sheets);
        const back = path(
          "M 20 11 V7 Q20 3 24 3 H33 L48 18 V38 Q48 42 44 42 H39 M33 3 V16 Q33 18 35 18 H48",
          { "stroke-width": 3.55 },
          sheets,
        );
        const front = path(
          "M 12 54 Q6.5 54 6.5 48 V18 Q6.5 13 12 13 H21 L38 30 V48 Q38 54 32 54 Z M21 13 V28 Q21 30 24 30 H38",
          { "stroke-width": 3.55 },
          sheets,
        );
        const tick = draw("M 14 29 L24 39 L43 18", 3.6);
        frame = (t) => {
          if (!confirmation) {
            const a = win(t, 0, 0.15, 0.85, 1);
            op(original, 1 - a);
            op(sheets, a);
            tr(back, 3 * B(t), -2 * B(t));
            tr(front, -3 * B(t), 2 * B(t));
            op(tick, 0);
            return;
          }
          const a = win(t, 0, 0.15, 0.43, 0.6),
            ok = win(t, 0.43, 0.6, 0.82, 1);
          op(original, 1 - Math.max(a, ok));
          op(sheets, a);
          tr(back, 3 * B(t, 0, 0.62), -2 * B(t, 0, 0.62));
          tr(front, -3 * B(t, 0, 0.62), 2 * B(t, 0, 0.62));
          op(tick, ok);
          set(
            tick,
            "stroke-dashoffset",
            Number(tick.getAttribute("data-length")) *
              (1 - ramp(t, 0.45, 0.68)),
          );
        };
        break;
      }
      case "X":
        frame = (t) => tr(root, 0, 0, 90 * ramp(t), 28, 28, 1 - 0.12 * B(t));
        break;
      case "LoaderCircle":
        frame = (t) => tr(root, 0, 0, 360 * ramp(t));
        break;
      case "Pin":
        frame = (t) => {
          let b = B(t);
          tr(root, 0, -5 * b, -16 * b, 28, 43);
        };
        break;
      case "Archive": {
        const source = full();
        parts.forEach((p) => p.remove());
        const lid = slice(source, [-10, -10, 76, 29]),
          body = slice(source, [-10, 19, 76, 47]);
        frame = (t) => {
          tr(lid, 0, -4 * B(t), -3 * B(t), 10, 18);
          tr(body, 0, 1.4 * B(t, 0.15, 0.98));
        };
        break;
      }
      case "RotateCcw":
        frame = (t) => tr(root, 0, 0, -360 * ramp(t));
        break;
      case "Download": {
        const src = full();
        parts.forEach((p) => p.remove());
        const base = slice(src, [-10, 44.46, 76, 22]),
          arrow = slice(src, [-10, -10, 76, 54.46]);
        frame = (t) => {
          tr(arrow, 0, -9 * B(t, 0, 0.85));
          tr(base, 0, 0, 0, 28, 46, 1 + 0.08 * B(t, 0.45, 1), 1);
        };
        break;
      }
      case "Play":
        frame = (t) => tr(root, 3 * B(t), 0, 0, 12, 28, 1 - 0.14 * B(t), 1);
        break;
      case "Pause":
        frame = (t) => {
          tr(parts[0], -3 * B(t), 0);
          tr(parts[1], 3 * B(t, 0.07, 1), 0);
        };
        break;
      case "Workflow": {
        const upper = trace("M28 15 V26", 9),
          lower = trace("M28 35 V52", 9);
        frame = (t) => {
          op(parts[0], 1 - 0.5 * B(t));
          ink(upper, t, 0.1, 0.4);
          ink(lower, t, 0.4, 0.78);
        };
        break;
      }
      case "Blocks":
        frame = (t) =>
          parts.forEach((p, i) => {
            let b = B(t, i * 0.07, 0.72 + i * 0.07);
            tr(p, (i % 2 ? 3 : -3) * b, (i < 2 ? -3 : 3) * b);
          });
        break;
      case "ExternalLink":
        frame = (t) => tr(parts[1], 7 * B(t), -7 * B(t));
        break;
      case "BrainCircuit": {
        const filament = draw(
          "M23 36 V27 L19 21 M23 27 L28 23 L33 27 L37 21 M33 27 V36",
          2.4,
        );
        frame = (t) => {
          ink(filament, t, 0.12, 0.75);
          parts.slice(1).forEach((p, i) => {
            op(p, 1 - 0.6 * B(t, 0.1 + i * 0.15, 0.8 + i * 0.15));
            tr(p, 0, (i + 1) * B(t) * 0.8);
          });
        };
        break;
      }
      case "Paperclip": {
        const inkline = trace(
          "M17 28 L34 11 C43 2 52 11 44 20 L20 46 C10 57 0 43 11 32 L34 8 C40 2 47 9 41 15 L20 37 C16 41 12 36 16 32 L31 17",
          2.6,
        );
        frame = (t) => {
          op(parts[0], 1 - 0.7 * B(t));
          ink(inkline, t, 0.08, 0.88);
        };
        break;
      }
      case "Send":
        frame = (t) => {
          if (t < 0.65) {
            const u = ramp(t, 0.12, 0.65);
            tr(
              root,
              32 * u - 3 * B(t, 0, 0.3),
              -32 * u + 3 * B(t, 0, 0.3),
              -5 * B(t),
            );
            op(root, 1 - ramp(t, 0.38, 0.65));
          } else {
            tr(root, -7 * (1 - ramp(t, 0.65, 1)), 7 * (1 - ramp(t, 0.65, 1)));
            op(root, ramp(t, 0.65, 1));
          }
        };
        break;
      case "SlidersHorizontal": {
        const centers = [36.4, 19.85, 36.4];
        frame = (t) =>
          parts.forEach((p, i) => {
            let c = centers[i],
              dx = (i === 1 ? 12 : -12) * B(t, i * 0.07, 0.82 + i * 0.07);
            warp(p, item.groups[i].d, (x, y) => {
              const weight =
                x < c - 6
                  ? clamp((x - 4.38) / (c - 6 - 4.38))
                  : x > c + 6
                    ? clamp((51.62 - x) / (51.62 - c - 6))
                    : 1;
              return [x + dx * weight, y];
            });
          });
        break;
      }
      case "Activity": {
        const line = trace("M 6 31 H15 L22 7 L31 49 L37 25 L42 31 H50", 2.7);
        frame = (t) => {
          op(parts[0], 1 - 0.65 * B(t));
          ink(line, t, 0.08, 0.88);
        };
        break;
      }
      case "User":
        frame = (t) => tr(parts[1], 2.5 * B(t), 0.8 * B(t), 9 * B(t), 28, 27);
        break;
      case "Trash2": {
        const src = full();
        parts.forEach((p) => p.remove());
        const body = slice(src, [-10, 14.4, 76, 52]),
          lid = slice(src, [-10, -10, 76, 24.4]);
        frame = (t) => tr(lid, 0, -2 * B(t), -18 * B(t), 10, 14.4);
        break;
      }
      case "RefreshCw":
        frame = (t) => tr(root, 0, 0, 360 * ramp(t, 0.02, 0.98));
        break;
      case "Keyboard":
        frame = (t) =>
          parts.slice(1).forEach((p, i) => {
            let start = ((i * 7) % 17) / 25,
              b = B(t, start, Math.min(1, start + 0.24));
            op(p, 1 - 0.6 * b);
            tr(p, 0, 0.9 * b);
          });
        break;
      case "Image":
        frame = (t) => {
          let b = B(t);
          tr(parts[1], 5 * b, -4 * b);
        };
        break;
      case "Volume2":
        frame = (t) => {
          [parts[2], parts[1]].forEach((p, i) => {
            let b = B(t, 0.06 + i * 0.18, 0.73 + i * 0.18);
            tr(p, 2 * b, 0, 0, 29, 28, 1, 1 + 0.12 * b);
            op(p, 1 - 0.65 * b);
          });
        };
        break;
      case "Inbox": {
        const paper = path("M20 13 V4 H36 V13", {
          "stroke-width": 2.5,
          opacity: 0,
        });
        frame = (t) => {
          op(paper, win(t, 0, 0.2, 0.55, 0.9));
          tr(paper, 0, 15 * ramp(t, 0.1, 0.8));
        };
        break;
      }
      case "Mail": {
        const source = item.groups[0].d;
        frame = (t) =>
          warp(parts[0], source, (x, y) => {
            const weight =
              Math.max(0, 1 - Math.abs(x - 28) / 23) *
              Math.max(0, 1 - Math.abs(y - 31) / 8);
            return [x, y - 13 * B(t) * weight];
          });
        break;
      }
      case "Calendar":
        frame = (t) =>
          parts.slice(1).forEach((p, i) => {
            let b = B(t, i * 0.045, 0.5 + i * 0.045);
            op(p, 1 - 0.8 * b);
            tr(p, 0, -1.4 * b);
          });
        break;
      case "MessageCircle": {
        const dots = [19, 28, 37].map((cx) =>
          extra("circle", { cx, cy: 27, r: 2, opacity: 0 }),
        );
        frame = (t) =>
          dots.forEach((p, i) => {
            const b = B(t, 0.08 + i * 0.13, 0.7 + i * 0.13);
            op(p, b);
            tr(p, 0, -2 * b);
          });
        break;
      }
      case "Braces":
        frame = (t) => {
          let b = B(t);
          tr(parts[1], 4 * b, 0);
          tr(parts[2], -4 * b, 0);
          tr(parts[0], 0, 0, -9 * B(t, 0.1, 0.95));
        };
        break;
      case "Sparkles":
        frame = (t) =>
          parts.forEach((p, i) => {
            let b = B(t, i * 0.06, 0.73 + i * 0.06),
              box = item.groups[i].box,
              cx = (box[0] + box[2]) / 2,
              cy = (box[1] + box[3]) / 2;
            if (i === 3) tr(p, -2 * b, -2 * b, -7 * b, 40, 38);
            else
              tr(
                p,
                0,
                0,
                90 * B(t, i * 0.05, 0.78 + i * 0.05),
                cx,
                cy,
                1 + 0.16 * b,
              );
          });
        break;
      case "AlertCircle":
        frame = (t) => {
          tr(parts[1], 0, -1.5 * B(t), 0, 28, 32, 1, 1 + 0.16 * B(t));
          op(parts[2], 1 - 0.35 * B(t, 0.15, 0.95));
        };
        break;
      case "LogIn":
        frame = (t) => tr(parts[1], 6 * B(t), 0);
        break;
      case "HardDrive": {
        const signals = [19, 43].map((y) =>
          path("M 21 " + y + " H35", { "stroke-width": 2.5, opacity: 0 }),
        );
        frame = (t) =>
          signals.forEach((p, i) => {
            const b = B(t, 0.05 + i * 0.25, 0.65 + i * 0.25);
            op(p, b);
            tr(p, 0, 0, 0, 21, 28, 0.3 + 0.7 * b, 1);
          });
        break;
      }
      case "Lock": {
        const source = item.groups[0].d;
        frame = (t) =>
          warp(parts[0], source, (x, y) => {
            let w = clamp((26 - y) / 10),
              b = B(t);
            return [x + 4 * b * w, y - 4 * b * w];
          });
        break;
      }
      case "PhoneOff":
        frame = (t) => {
          let b = B(t);
          tr(root, 0, -4 * b, -8 * b, 28, 30);
        };
        break;
      case "AudioLines":
        frame = (t) =>
          parts.forEach((p, i) => {
            const box = item.groups[i].box,
              cx = (box[0] + box[2]) / 2;
            tr(
              p,
              0,
              0,
              0,
              cx,
              28,
              1,
              1 + 0.32 * B(t) * Math.sin(t * Math.PI * 4 - cx * 0.18),
            );
          });
        break;
      case "Briefcase": {
        const source = item.groups[0].d;
        frame = (t) => {
          let b = B(t);
          warp(parts[0], source, (x, y) => [
            x,
            y - 4 * b * clamp((21 - y) / 12),
          ]);
          tr(root, 0, -2 * B(t, 0.18, 0.98));
        };
        break;
      }
      case "Zap": {
        const line = trace("M34 5 L15 31 H29 L23 51 L42 23 H29 Z", 3);
        frame = (t) => {
          op(parts[0], 1 - 0.7 * B(t));
          ink(line, t, 0.08, 0.8);
        };
        break;
      }
      default:
        throw Error("Missing motion: " + item.name);
    }
  if (!frame) throw Error("Missing motion: " + item.name);
  if (["Bell", "Trash2"].includes(item.name)) {
    svg.insertBefore(originalSnapshot, root);
    op(root, 0);
    const move = frame;
    frame = (t) => {
      move(t);
      const alpha = win(t, 0, 0.08, 0.92, 1);
      op(root, alpha);
      op(originalSnapshot, 1 - alpha);
    };
  }
  // All inserted geometry exists before the baseline is captured. Reset never replaces nodes.
  const baseline = [svg, ...svg.querySelectorAll("*")].map((el) => [
    el,
    [...el.attributes].map((a) => [a.name, a.value]),
  ]);
  const reset = () => {
    for (const [el, attrs] of baseline) {
      for (const a of [...el.attributes]) el.removeAttribute(a.name);
      for (const [k, v] of attrs) el.setAttribute(k, v);
    }
  };
  return { svg, frame, reset, item };
}
