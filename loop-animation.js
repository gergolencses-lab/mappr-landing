/**
 * loop-animation.js — Interactive Draggable Causal Loop
 * Real Hungarian nodes from Mappr output demo.
 * Features: scroll-triggered 3-phase reveal + drag-to-reposition + hover highlights.
 */

(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const W = 480, H = 480, R = 44;

  /* ── Node definitions ──────────────────────────────────────────── */
  const NODES = [
    { id: 'doc-quality', lines: ['Bizonylatolás', 'Minősége'],  type: 'constraint', color: '#D0021B', x: 240, y: 82  },
    { id: 'automation',  lines: ['Automatizáció', 'Foka'],      type: 'driver',     color: '#4A90E2', x: 76,  y: 180 },
    { id: 'accountant',  lines: ['Könyvelői', 'Ellenállás'],    type: 'amplifier',  color: '#F5A623', x: 404, y: 180 },
    { id: 'simplicity',  lines: ['Rendszer', 'Egyszerűsége'],   type: 'dampener',   color: '#7ED321', x: 240, y: 258 },
    { id: 'manual',      lines: ['Manuális', 'Munka'],          type: 'amplifier',  color: '#F5A623', x: 100, y: 372 },
    { id: 'illusion',    lines: ['Tulajdonosi', 'Illúzió'],     type: 'symptom',    color: '#9B9B9B', x: 374, y: 372 },
  ];

  /* ── Edge definitions ──────────────────────────────────────────── */
  const EDGES = [
    { from: 'doc-quality', to: 'automation'  },
    { from: 'automation',  to: 'doc-quality' }, // bidirectional pair — curves opposite ways
    { from: 'doc-quality', to: 'accountant'  },
    { from: 'accountant',  to: 'simplicity'  },
    { from: 'accountant',  to: 'illusion'    },
    { from: 'simplicity',  to: 'doc-quality' },
    { from: 'simplicity',  to: 'manual'      },
    { from: 'illusion',    to: 'manual'      },
    { from: 'manual',      to: 'automation'  },
  ];

  const LEVERAGE_ID = 'simplicity';

  /* ── Mutable position state ────────────────────────────────────── */
  const pos = {};
  NODES.forEach(n => { pos[n.id] = { x: n.x, y: n.y }; });

  /* ── State ─────────────────────────────────────────────────────── */
  let currentPhase = 0;
  let idleStarted  = false;
  let svg          = null;
  const nodeEls    = {}; // id → { outer, inner, circle }
  const edgeEls    = {}; // "a→b" → path element
  let leverageRing = null;
  let leverageBadge = null;
  let hintEl        = null;

  /* ── Helpers ───────────────────────────────────────────────────── */
  function eKey(e) { return e.from + '→' + e.to; }

  function mk(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  /**
   * Quadratic bezier path between two nodes.
   * Curves using a perpendicular offset so bidirectional edges don't overlap.
   * sign: +1 or -1 controls which side the curve bows to.
   */
  function buildPath(fromId, toId, sign = 1) {
    const f = pos[fromId], t = pos[toId];
    const dx = t.x - f.x, dy = t.y - f.y;
    const len = Math.hypot(dx, dy) || 1;

    // Perpendicular unit vector
    const px = -dy / len, py = dx / len;

    // Control point = midpoint + perpendicular offset
    const CURVE = 38 * sign;
    const cx = (f.x + t.x) / 2 + px * CURVE;
    const cy = (f.y + t.y) / 2 + py * CURVE;

    // Start: from circle-edge toward ctrl
    const sd = Math.hypot(cx - f.x, cy - f.y) || 1;
    const sx = f.x + (cx - f.x) / sd * (R + 3);
    const sy = f.y + (cy - f.y) / sd * (R + 3);

    // End: from circle-edge toward ctrl (approach from ctrl side)
    const ed = Math.hypot(t.x - cx, t.y - cy) || 1;
    const ex = t.x - (t.x - cx) / ed * (R + 7);
    const ey = t.y - (t.y - cy) / ed * (R + 7);

    return { d: `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`, cx, cy };
  }

  /* Determine curve sign per edge (bidirectional pairs get opposite signs) */
  function getCurveSign(edge) {
    const reverse = EDGES.find(e => e.from === edge.to && e.to === edge.from);
    if (!reverse) return 1;
    return EDGES.indexOf(edge) < EDGES.indexOf(reverse) ? 1 : -1;
  }

  function redrawEdgesFor(nodeId) {
    EDGES.forEach(edge => {
      if (edge.from !== nodeId && edge.to !== nodeId) return;
      const path = edgeEls[eKey(edge)];
      if (!path) return;
      const { d } = buildPath(edge.from, edge.to, getCurveSign(edge));
      path.setAttribute('d', d);

      // Re-store length for any future reset
      requestAnimationFrame(() => {
        const len = path.getTotalLength();
        path.setAttribute('data-length', len);
      });
    });

    // Sync leverage ring + badge
    if (nodeId === LEVERAGE_ID && leverageRing) {
      leverageRing.setAttribute('cx', pos[LEVERAGE_ID].x);
      leverageRing.setAttribute('cy', pos[LEVERAGE_ID].y);
    }
    if (nodeId === LEVERAGE_ID && leverageBadge) {
      leverageBadge.setAttribute('x', pos[LEVERAGE_ID].x + R - 4);
      leverageBadge.setAttribute('y', pos[LEVERAGE_ID].y - R + 6);
    }
  }

  /* ── Build SVG ─────────────────────────────────────────────────── */
  function buildSVG() {
    svg = document.getElementById('loop-svg');
    if (!svg) return;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    /* Defs: arrowhead markers */
    const defs = mk('defs', {});
    function makeMarker(id, color) {
      const m = mk('marker', { id, markerWidth: '8', markerHeight: '8', refX: '6', refY: '3', orient: 'auto' });
      m.appendChild(mk('polygon', { points: '0 0, 6 3, 0 6', fill: color }));
      defs.appendChild(m);
    }
    makeMarker('arrow-grey', '#CBD5E1');
    NODES.forEach(n => makeMarker('arrow-' + n.id, n.color));
    svg.appendChild(defs);

    /* Layers */
    const edgeLayer = mk('g', { id: 'edge-layer' });
    const nodeLayer = mk('g', { id: 'node-layer' });
    svg.appendChild(edgeLayer);
    svg.appendChild(nodeLayer);

    /* Edges */
    EDGES.forEach(edge => {
      const sign = getCurveSign(edge);
      const { d } = buildPath(edge.from, edge.to, sign);
      const path = mk('path', {
        d, fill: 'none', stroke: '#CBD5E1', 'stroke-width': '2',
        'marker-end': 'url(#arrow-grey)', opacity: '0',
        'data-from': edge.from, 'data-to': edge.to, 'data-sign': sign,
      });
      edgeLayer.appendChild(path);
      edgeEls[eKey(edge)] = path;
      requestAnimationFrame(() => {
        const len = path.getTotalLength();
        path.style.strokeDasharray = len;
        path.style.strokeDashoffset = len;
        path.setAttribute('data-length', len);
      });
    });

    /* Nodes — outer group for position, inner for CSS animation */
    NODES.forEach(node => {
      const { x, y } = pos[node.id];

      const outer = mk('g', { transform: `translate(${x},${y})`, 'data-id': node.id });
      const inner = mk('g', {});
      inner.style.cssText = 'transform-box: fill-box; transform-origin: center; opacity: 0; transform: scale(0); cursor: grab;';

      const circle = mk('circle', {
        r: R, fill: node.color, 'fill-opacity': '0.15',
        stroke: node.color, 'stroke-width': '2',
      });

      /* Multi-line label */
      const text = mk('text', {
        'text-anchor': 'middle',
        fill: node.color,
        'font-family': 'DM Sans, sans-serif',
        'font-size': '10.5',
        'font-weight': '700',
      });
      text.style.cssText = 'pointer-events: none; user-select: none;';

      const lineH = 13, totalH = node.lines.length * lineH;
      node.lines.forEach((line, i) => {
        const ts = mk('tspan', { x: '0', y: `${-totalH / 2 + lineH * i + lineH * 0.75}` });
        ts.textContent = line;
        text.appendChild(ts);
      });

      inner.appendChild(circle);
      inner.appendChild(text);
      outer.appendChild(inner);
      nodeLayer.appendChild(outer);
      nodeEls[node.id] = { outer, inner, circle };
    });

    /* Leverage pulse ring */
    const lvColor = NODES.find(n => n.id === LEVERAGE_ID).color;
    leverageRing = mk('circle', {
      cx: pos[LEVERAGE_ID].x, cy: pos[LEVERAGE_ID].y, r: R,
      fill: 'none', stroke: lvColor, 'stroke-width': '2.5', opacity: '0',
    });
    leverageRing.style.pointerEvents = 'none';
    nodeLayer.insertBefore(leverageRing, nodeEls[LEVERAGE_ID].outer);

    /* Badge ⚡ */
    leverageBadge = mk('text', {
      x: pos[LEVERAGE_ID].x + R - 4,
      y: pos[LEVERAGE_ID].y - R + 6,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-size': '14', opacity: '0',
    });
    leverageBadge.style.cssText = 'transition: opacity 0.4s ease; pointer-events: none;';
    leverageBadge.textContent = '⚡';
    nodeLayer.appendChild(leverageBadge);

    /* Drag hint — appears after phase 1 */
    hintEl = mk('text', {
      x: W / 2, y: H - 10,
      'text-anchor': 'middle', 'dominant-baseline': 'auto',
      fill: '#B5B0A8', 'font-size': '10', 'font-family': 'DM Sans, sans-serif',
      opacity: '0',
    });
    hintEl.style.cssText = 'transition: opacity 0.6s ease; pointer-events: none;';
    hintEl.textContent = '✦ drag nodes to explore';
    svg.appendChild(hintEl);

    attachInteractions(nodeLayer);
  }

  /* ── Interactions ──────────────────────────────────────────────── */
  function attachInteractions(nodeLayer) {
    let dragging     = null;
    let dragOffX     = 0, dragOffY = 0;

    function svgPt(clientX, clientY) {
      const pt = svg.createSVGPoint();
      pt.x = clientX; pt.y = clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse());
    }

    function findGroup(el) {
      let cur = el;
      while (cur && cur !== svg) {
        if (cur.hasAttribute && cur.getAttribute('data-id')) return cur;
        cur = cur.parentNode;
      }
      return null;
    }

    /* ── Hover: highlight connected edges ── */
    nodeLayer.addEventListener('mouseenter', e => {
      const g = findGroup(e.target);
      if (!g || dragging) return;
      const id = g.getAttribute('data-id');
      const node = NODES.find(n => n.id === id);
      EDGES.forEach(edge => {
        if (edge.from !== id && edge.to !== id) return;
        const p = edgeEls[eKey(edge)];
        if (!p) return;
        p.setAttribute('stroke', node.color);
        p.setAttribute('stroke-width', '2.5');
        p.setAttribute('marker-end', `url(#arrow-${id})`);
        p.style.transition = 'stroke 0.2s ease';
      });
    }, true);

    nodeLayer.addEventListener('mouseleave', e => {
      const g = findGroup(e.target);
      if (!g || dragging) return;
      const id = g.getAttribute('data-id');
      EDGES.forEach(edge => {
        if (edge.from !== id && edge.to !== id) return;
        // Keep leverage coloring in phase 3
        if (currentPhase >= 3 && (edge.from === LEVERAGE_ID || edge.to === LEVERAGE_ID)) return;
        const p = edgeEls[eKey(edge)];
        if (!p) return;
        p.setAttribute('stroke', '#CBD5E1');
        p.setAttribute('stroke-width', '2');
        p.setAttribute('marker-end', 'url(#arrow-grey)');
      });
    }, true);

    /* ── Drag ── */
    function startDrag(clientX, clientY, target) {
      if (currentPhase < 1) return;
      const g = findGroup(target);
      if (!g) return;
      const id = g.getAttribute('data-id');
      if (!nodeEls[id]) return;
      const p = svgPt(clientX, clientY);
      dragging   = id;
      dragOffX   = p.x - pos[id].x;
      dragOffY   = p.y - pos[id].y;
      const inner = nodeEls[id].inner;
      inner.style.cursor   = 'grabbing';
      inner.style.animation = 'none';
      // Bring node to front
      const nodeLayer = document.getElementById('node-layer');
      nodeLayer.appendChild(nodeEls[id].outer);
      if (id === LEVERAGE_ID && leverageRing) {
        nodeLayer.insertBefore(leverageRing, nodeEls[id].outer);
      }
    }

    function moveDrag(clientX, clientY) {
      if (!dragging) return;
      const p = svgPt(clientX, clientY);
      const x = Math.max(R + 5, Math.min(W - R - 5, p.x - dragOffX));
      const y = Math.max(R + 5, Math.min(H - R - 5, p.y - dragOffY));
      pos[dragging].x = x;
      pos[dragging].y = y;
      nodeEls[dragging].outer.setAttribute('transform', `translate(${x},${y})`);
      redrawEdgesFor(dragging);
    }

    function endDrag() {
      if (!dragging) return;
      const inner = nodeEls[dragging].inner;
      inner.style.cursor = 'grab';
      if (idleStarted) {
        const i = NODES.findIndex(n => n.id === dragging);
        inner.style.animation = `breathe 3s ease-in-out ${i * 0.4}s infinite`;
      }
      dragging = null;
    }

    svg.addEventListener('mousedown',  e => startDrag(e.clientX, e.clientY, e.target));
    window.addEventListener('mousemove', e => moveDrag(e.clientX, e.clientY));
    window.addEventListener('mouseup',   endDrag);

    svg.addEventListener('touchstart', e => {
      e.preventDefault();
      startDrag(e.touches[0].clientX, e.touches[0].clientY, e.target);
    }, { passive: false });
    window.addEventListener('touchmove', e => {
      if (!dragging) return;
      e.preventDefault();
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    window.addEventListener('touchend', endDrag);
  }

  /* ── Animation phases ──────────────────────────────────────────── */

  function phase1() {
    if (currentPhase >= 1) return;
    currentPhase = 1;
    NODES.forEach((node, i) => {
      const inner = nodeEls[node.id].inner;
      setTimeout(() => {
        inner.style.transition = 'opacity 0.3s ease, transform 0.5s cubic-bezier(0.34,1.56,0.64,1)';
        inner.style.opacity    = '1';
        inner.style.transform  = 'scale(1)';
      }, i * 200);
    });
    // Show drag hint after nodes appear
    setTimeout(() => {
      if (hintEl) hintEl.style.opacity = '1';
    }, NODES.length * 200 + 400);
  }

  function phase2() {
    if (currentPhase >= 2) return;
    currentPhase = 2;
    phase1();
    EDGES.forEach((edge, i) => {
      const path = edgeEls[eKey(edge)];
      const len  = parseFloat(path.getAttribute('data-length')) || 200;
      setTimeout(() => {
        path.style.transition        = 'stroke-dashoffset 0.6s ease, opacity 0.2s ease';
        path.style.opacity           = '1';
        path.style.strokeDashoffset  = '0';
      }, i * 130);
    });
  }

  function phase3() {
    if (currentPhase >= 3) return;
    currentPhase = 3;
    phase2();

    const lvNode  = NODES.find(n => n.id === LEVERAGE_ID);
    const { circle } = nodeEls[LEVERAGE_ID];

    setTimeout(() => {
      circle.setAttribute('fill-opacity', '0.25');
      circle.setAttribute('stroke-width',  '2.5');

      leverageRing.style.opacity         = '0.4';
      leverageRing.style.transformOrigin = `${pos[LEVERAGE_ID].x}px ${pos[LEVERAGE_ID].y}px`;
      leverageRing.style.animation       = 'pulse-ring 2s ease-in-out infinite';
      leverageBadge.style.opacity        = '1';

      EDGES.forEach(edge => {
        if (edge.from !== LEVERAGE_ID && edge.to !== LEVERAGE_ID) return;
        const path = edgeEls[eKey(edge)];
        path.style.transition = 'stroke 0.5s ease';
        path.setAttribute('stroke',     lvNode.color);
        path.setAttribute('marker-end', `url(#arrow-${LEVERAGE_ID})`);
      });

      startIdleLoop();
    }, 300);
  }

  function startIdleLoop() {
    if (idleStarted) return;
    idleStarted = true;
    NODES.forEach((node, i) => {
      nodeEls[node.id].inner.style.animation = `breathe 3s ease-in-out ${i * 0.4}s infinite`;
    });
  }

  /* ── Public API (called from main.js scroll triggers) ──────────── */
  window.loopPhase = function (n) {
    if (n === 1) phase1();
    else if (n === 2) phase2();
    else if (n === 3) phase3();
  };

  document.addEventListener('DOMContentLoaded', buildSVG);
})();
