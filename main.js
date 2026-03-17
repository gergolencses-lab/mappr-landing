/**
 * main.js
 * Scroll triggers, navbar behaviour, Act 2 & 4 animations.
 */

(function () {
  'use strict';

  /* ── Navbar shadow on scroll ─────────────────────────────── */
  const navbar = document.querySelector('.navbar');
  const heroSection = document.querySelector('.hero');

  function onScroll() {
    const heroBottom = heroSection ? heroSection.offsetHeight : 400;
    if (window.scrollY > heroBottom * 0.6) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    updateShiftProgress();
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ── Act 2 — Problem lines (IntersectionObserver) ────────── */
  const animTargets = document.querySelectorAll(
    '.problem__line, .problem__divider, .problem__epilogue'
  );

  if (animTargets.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const el = entry.target;
            const delay = parseInt(el.dataset.delay || 0);
            setTimeout(() => el.classList.add('visible'), delay);
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.3 }
    );
    animTargets.forEach(el => io.observe(el));
  }

  /* ── Act 4 — How It Works cards ──────────────────────────── */
  const cards = document.querySelectorAll('.how__card');

  if (cards.length) {
    const cardIO = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const el = entry.target;
            const delay = parseInt(el.dataset.delay || 0);
            setTimeout(() => el.classList.add('visible'), delay);
            cardIO.unobserve(el);
          }
        });
      },
      { threshold: 0.2 }
    );
    cards.forEach(el => cardIO.observe(el));
  }

  /* ── Act 3 — Shift section scroll-phase logic ────────────── */
  const shiftSection = document.querySelector('.shift');
  const shiftSteps   = document.querySelectorAll('.shift__step');

  function updateShiftProgress() {
    if (!shiftSection) return;
    const rect = shiftSection.getBoundingClientRect();
    const sectionH = shiftSection.offsetHeight;
    const vh = window.innerHeight;

    /* Progress 0→1 as section scrolls through viewport */
    const scrolled = -rect.top;
    const total    = sectionH - vh;
    const progress = Math.max(0, Math.min(1, scrolled / Math.max(total, 1)));

    /* Three bands: 0–0.33 = step1, 0.33–0.66 = step2, 0.66–1 = step3 */
    const activeStep = progress < 0.33 ? 0 : progress < 0.66 ? 1 : 2;

    shiftSteps.forEach((el, i) => {
      el.classList.toggle('active', i === activeStep);
    });

    /* Trigger loop phases */
    if (progress >= 0.1 && window.loopPhase) window.loopPhase(1);
    if (progress >= 0.4 && window.loopPhase) window.loopPhase(2);
    if (progress >= 0.7 && window.loopPhase) window.loopPhase(3);
  }

  /* ── Smooth-scroll secondary CTA ─────────────────────────── */
  const secondaryCTA = document.querySelector('[data-scroll-to]');
  if (secondaryCTA) {
    secondaryCTA.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(secondaryCTA.dataset.scrollTo);
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  }

  /* ── Init ─────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    onScroll(); // run once on load
  });
})();
