/* Marga drawn marks.
   ==========================================================================================
   Plays the hand-drawn SVG marks under headline words once, the first time each one is half
   in view. The marks and their timing live in marga-v4.css; this file only decides when.

     <span class="mk mk-under" data-draw>framework.<svg ...><path class="s" .../></svg></span>

   data-draw="hero" marks are not touched here. They play on load from the stylesheet alone,
   so the first thing a visitor sees does not wait on a script.

   With reduced motion the stylesheet shows every mark finished and this file does nothing,
   because a mark that pops in on scroll is still motion. With no IntersectionObserver every
   mark is drawn at once rather than never.
   ========================================================================================== */
(function () {
  'use strict';

  var marks = Array.prototype.slice.call(
    document.querySelectorAll('[data-draw]:not([data-draw="hero"])'));
  if (!marks.length) return;

  var draw = function (el) { el.classList.add('is-drawn'); };

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) {
    marks.forEach(draw);
    return;
  }

  // Half visible, and above the bottom 12% of the viewport, so a mark draws where the eye is
  // rather than while it is still sliding in under the fold.
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      draw(entry.target);
      io.unobserve(entry.target);
    });
  }, { threshold: 0.5, rootMargin: '0px 0px -12% 0px' });

  marks.forEach(function (el) { io.observe(el); });
}());
