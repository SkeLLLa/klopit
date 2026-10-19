// Runs before first paint (loaded synchronously from app.html) so the saved
// theme and sidebar state apply without a flash. External file so the CSP
// needs no inline-script allowance.
(function () {
  var d = localStorage.getItem('darkMode');
  if (
    d === 'true' ||
    (d === null && matchMedia('(prefers-color-scheme: dark)').matches)
  ) {
    document.documentElement.classList.add('dark');
  }
  if (localStorage.getItem('sidebarCollapsed') === 'true') {
    document.documentElement.dataset.sidebarCollapsed = '';
  }
})();
