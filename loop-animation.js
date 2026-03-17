/**
 * loop-animation.js
 * Causal loop diagram — SVG-based, 3-phase scroll-triggered animation.
 * Phase control exposed via window.loopPhase(n) called from main.js.
 */

(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const W = 480, H = 480, CX = 240, CY = 240, R_NODE = 40, ORBIT = 155;

  /* ── Node definitions ─────────────────────────────────────── */
  const NODES = [
    { id: 'complexity',  label: 'Complexity',  type: 'driver',      color: '#4A90E2', angle: 270 },
    { id: 'decisions',   label: 'Decisions',   type: 'amplifier',   color: '#F5A623', angle: 342 },
    { id: 'outcomes',    label: 'Outcomes',    type: 'symptom',     color: '#9B9B9B', angle: 54  },
    { id: 'resistance',  label: 'Resistance',  type: 'constraint',  color: '#D0021B', angle: 126 },
    { id: 'insight',     label: 'Insight',     type: 'dampener',    color: '#7ED321', angle: 198 },
  ];

  /* ── Edge definitions (from → to) ────────────────────────── */
  const EDGES = [
    { from: 'complexity', to: 'decisions'  },
    { from: 'decisions',  to: 'outcomes'   },
    { from: 'outcomes',   to: 'resistance' },
    { from: 'resistance', to: 'complexity' },
    { from: 'insight',    to: 'complexity' },
    { from: 'insight',    to: 'resistance' },
  ];

  /* Leverage node — the hub that lights up in phase 3 */
  const LEVERAGE_ID = 'complexity';

  /* ── State ────────────────────────────────────────────────── */
  let currentPhase = 0;
  let phaseInProgress = false;
  const nodeEls = {};   // id → { circle, label, group }
  const edgeEls = {};   // "from→to" → { path, marker }
  let leverageRing = null;
  let leverageBadge = null;
  let breatheTimers = [];
  let idleStarted = false;

  /* ── Helpers ──────────────────────────────────────────────── */
  function deg2rad(d) { return (d * Math.PI) / 180; }

  function nodePos(node) {
    return {
      x: CX + ORBIT * Math.cos(deg2rad(node.angle)),
      y: CY + ORBIT * Math.sin(deg2rad(node.angle)),
    };
  }

  function edgeKey(e) { return e.from + '→' + e.to; }

  /* Quadratic bezier control point curving TOWARD center */
  function bezierCtrl(p1, p2, pull = 0.35) {
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    return {
      x: mx + (CX - mx) * pull,
      y: my + (CY - my) * pull,
    };
  }

  /* Point on circle edge (for clean connection start/end) */
  function edgeEndpoint(from, to, rOffset = R_NODE + 4) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    return { x: from.x + dx / d * rOffset, y: from.y + dy / d * rOffset };
  }

  function makeSVGEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  /* ── Build SVG ────────────────────────────────────────────── */
  function buildSVG() {
    const svg = document.getElementById('loop-svg');
    if (!svg) return;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    /* Defs — arrowhead markers */
    const defs = makeSVGEl('defs', {});

    function makeMarker(id, color) {
      const marker = makeSVGEl('marker', {
        id, markerWidth: '8', markerHeight: '8',
        refX: '6', refY: '3', orient: 'auto',
      });
      const poly = makeSVGEl('polygon', {
        points: '0 0, 6 3, 0 6',
        fill: color,
      });
      marker.appendChild(poly);
      defs.appendChild(marker);
      return marker;
    }

    /* Default grey marker + one per active node color */
    makeMarker('arrow-grey', '#CBD5E1');
    NODES.forEach(n => makeMarker('arrow-' + n.id, n.color));
    svg.appendChild(defs);

    /* Layer: edges (below nodes) */
    const edgeLayer = makeSVGEl('g', { id: 'edge-layer' });
    svg.appendChild(edgeLayer);

    /* Layer: nodes */
    const nodeLayer = makeSVGEl('g', { id: 'node-layer' });
    svg.appendChild(nodeLayer);

    /* Draw edges */
    EDGES.forEach(edge => {
      const fromNode = NODES.find(n => n.id === edge.from);
      const toNode   = NODES.find(n => n.id === edge.to);
      const fp = nodePos(fromNode), tp = nodePos(toNode);
      const ctrl = bezierCtrl(fp, tp);
      const start = edgeEndpoint(fp, ctrl);
      const end   = edgeEndpoint(tp, ctrl);

      const path = makeSVGEl('path', {
        d: `M ${start.x} ${start.y} Q ${ctrl.x} ${ctrl.y} ${end.x} ${end.y}`,
        fill: 'none',
        stroke: '#CBD5E1',
        'stroke-width': '2',
        'marker-end': 'url(#arrow-grey)',
        opacity: '0',
        'data-from': edge.from,
        'data-to': edge.to,
      });

      edgeLayer.appendChild(path);
      edgeEls[edgeKey(edge)] = path;

      /* Store path length for dash animation */
      requestAnimationFrame(() => {
        const len = path.getTotalLength();
        path.style.strokeDasharray = len;
        path.style.strokeDashoffset = len;
        path.setAttribute('data-length', len);
      });
    });

    /* Draw nodes */
    NODES.forEach(node => {
      const { x, y } = nodePos(node);
      const g = makeSVGEl('g', {
        transform: `translate(${x},${y})`,
        style: 'transform-box: fill-box; transform-origin: center; opacity: 0; transform: scale(0)',
        'data-id': node.id,
      });

      /* Fill circle */
      const circle = makeSVGEl('circle', {
        r: R_NODE,
        fill: node.color,
        'fill-opacity': '0.15',
        stroke: node.color,
        'stroke-width': '2',
      });

      /* Label */
      const text = makeSVGEl('text', {
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        fill: node.color,
        'font-family': 'DM Sans, sans-serif',
        'font-size': '11',
        'font-weight': '700',
        y: '1',
      });
      text.textContent = node.label;

      g.appendChild(circle);
      g.appendChild(text);
      nodeLayer.appendChild(g);
      nodeEls[node.id] = { group: g, circle, text };
    });

    /* Leverage ring (hidden initially) */
    const lvNode = NODES.find(n => n.id === LEVERAGE_ID);
    const { x: lx, y: ly } = nodePos(lvNode);
    leverageRing = makeSVGEl('circle', {
      cx: lx, cy: ly, r: R_NODE,
      fill: 'none',
      stroke: lvNode.color,
      'stroke-width': '2.5',
      opacity: '0',
      'data-pulse': 'true',
    });
    nodeLayer.insertBefore(leverageRing, nodeEls[LEVERAGE_ID].group);

    /* Badge "⚡" */
    leverageBadge = makeSVGEl('text', {
      x: lx + R_NODE - 6,
      y: ly - R_NODE + 6,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      'font-size': '14',
      opacity: '0',
      style: 'transition: opacity 0.4s ease',
    });
    leverageBadge.textContent = '⚡';
    nodeLayer.appendChild(leverageBadge);
  }

  /* ── Animation phases ─────────────────────────────────────── */

  function phase1() {
    if (currentPhase >= 1) return;
    currentPhase = 1;
    NODES.forEach((node, i) => {
      const g = nodeEls[node.id].group;
      setTimeout(() => {
        g.style.transition = 'opacity 0.3s ease, transform 0.5s cubic-bezier(0.34,1.56,0.64,1)';
        g.style.opacity = '1';
        g.style.transform = 'scale(1)';
      }, i * 200);
    });
  }

  function phase2() {
    if (currentPhase >= 2) return;
    currentPhase = 2;
    phase1(); // ensure nodes are visible
    EDGES.forEach((edge, i) => {
      const path = edgeEls[edgeKey(edge)];
      const len = parseFloat(path.getAttribute('data-length')) || 200;
      setTimeout(() => {
        path.style.transition = 'stroke-dashoffset 0.6s ease, opacity 0.2s ease';
        path.style.opacity = '1';
        path.style.strokeDashoffset = '0';
      }, i * 150);
    });
  }

  function phase3() {
    if (currentPhase >= 3) return;
    currentPhase = 3;
    phase2(); // ensure edges drawn

    /* Light up leverage node */
    const lvNode = NODES.find(n => n.id === LEVERAGE_ID);
    const { circle } = nodeEls[LEVERAGE_ID];
    setTimeout(() => {
      circle.setAttribute('fill-opacity', '0.25');
      circle.setAttribute('stroke-width', '2.5');

      /* Pulsing ring */
      leverageRing.style.opacity = '0.4';
      leverageRing.style.transformOrigin = `${leverageRing.getAttribute('cx')}px ${leverageRing.getAttribute('cy')}px`;
      leverageRing.style.animation = 'pulse-ring 2s ease-in-out infinite';

      /* Badge */
      leverageBadge.style.opacity = '1';

      /* Color connected edges */
      EDGES.forEach(edge => {
        if (edge.from === LEVERAGE_ID || edge.to === LEVERAGE_ID) {
          const path = edgeEls[edgeKey(edge)];
          const partnerId = edge.from === LEVERAGE_ID ? edge.to : edge.from;
          const partnerNode = NODES.find(n => n.id === partnerId);
          path.style.transition = 'stroke 0.5s ease';
          path.setAttribute('stroke', lvNode.color);
          path.setAttribute('marker-end', `url(#arrow-${LEVERAGE_ID})`);
          path.style.animation = 'edge-pulse 3s ease-in-out infinite';
        }
      });

      startIdleLoop();
    }, 200);
  }

  /* ── Idle breathing loop ──────────────────────────────────── */
  function startIdleLoop() {
    if (idleStarted) return;
    idleStarted = true;
    NODES.forEach((node, i) => {
      const g = nodeEls[node.id].group;
      g.style.animation = `breathe 3s ease-in-out ${i * 0.4}s infinite`;
    });
  }

  /* ── Public API ───────────────────────────────────────────── */
  window.loopPhase = function (n) {
    if (n === 1) phase1();
    else if (n === 2) phase2();
    else if (n === 3) phase3();
  };

  /* ── Init ─────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', buildSVG);
})();
