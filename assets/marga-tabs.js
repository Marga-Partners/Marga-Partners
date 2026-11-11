/* Marga tab explorer.
   ==========================================================================================
   Turns a list of questions and their answer panels into the WAI-ARIA tab pattern. The page
   ships plain markup that reads correctly with no script, every panel stacked in order:

     <div class="qx" data-tabs data-tabs-label="Questions clients arrive with">
       <div class="qx-list">
         <button class="qx-tab" type="button" data-for="qx-1">...</button>
         ...
       </div>
       <div class="qx-panels">
         <section class="qx-panel" id="qx-1">...</section>
         ...
       </div>
     </div>

   This adds the roles, states and roving tabindex, hides every panel but the selected one,
   and sets data-tabs-ready, which is what lets the stylesheet show the list.

   Keys: Left/Up and Right/Down move and select, wrapping at the ends; Home and End jump.
   Selection follows focus. That is the right choice here because a panel is a few lines of
   text already in the page, so moving through them costs nothing.
   ========================================================================================== */
(function () {
  'use strict';

  var uid = 0;

  Array.prototype.forEach.call(document.querySelectorAll('[data-tabs]'), function (root) {
    var list = root.querySelector('.qx-list');
    if (!list) return;
    var tabs = Array.prototype.slice.call(list.querySelectorAll('[data-for]'));
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('data-for')); });
    if (!tabs.length || panels.indexOf(null) !== -1) return;

    list.setAttribute('role', 'tablist');
    list.setAttribute('aria-orientation', 'vertical');
    var label = root.getAttribute('data-tabs-label');
    if (label) list.setAttribute('aria-label', label);

    tabs.forEach(function (tab, i) {
      if (!tab.id) tab.id = 'qx-tab-' + (++uid);
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', panels[i].id);
      panels[i].setAttribute('role', 'tabpanel');
      panels[i].setAttribute('aria-labelledby', tab.id);
      panels[i].setAttribute('tabindex', '0');
    });

    var select = function (i, focus) {
      tabs.forEach(function (tab, j) {
        var on = i === j;
        tab.setAttribute('aria-selected', String(on));
        tab.setAttribute('tabindex', on ? '0' : '-1');
        panels[j].hidden = !on;
      });
      if (focus) tabs[i].focus();
    };

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(i, false); });
    });

    list.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      var n = tabs.length, next = null;
      switch (e.key) {
        case 'ArrowDown': case 'ArrowRight': case 'Down': case 'Right': next = (i + 1) % n; break;
        case 'ArrowUp': case 'ArrowLeft': case 'Up': case 'Left': next = (i - 1 + n) % n; break;
        case 'Home': next = 0; break;
        case 'End': next = n - 1; break;
        default: return;
      }
      e.preventDefault();
      select(next, true);
    });

    var start = tabs.findIndex ? tabs.findIndex(function (t) {
      return t.getAttribute('aria-selected') === 'true';
    }) : -1;
    select(start < 0 ? 0 : start, false);
    root.setAttribute('data-tabs-ready', '');
  });
}());
