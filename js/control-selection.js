(function () {
  'use strict';

  // Moving onto a control transfers the same focus used by keyboard navigation.
  // Styling only that focus avoids highlighting the old and new choices together.
  document.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return;
    const control = event.target.closest('button:not(:disabled), .result-product-link, .product-link');
    if (!control || control.contains(event.relatedTarget) || control.closest('[hidden], [inert]')) return;
    control.focus({ preventScroll: true });
  });
})();
