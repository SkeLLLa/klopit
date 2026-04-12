function createThemeState() {
  let dark = $state(false);

  function init() {
    const stored = localStorage.getItem('darkMode');
    dark =
      stored === 'true' ||
      (stored === null && matchMedia('(prefers-color-scheme: dark)').matches);
    apply();
  }

  function toggle() {
    dark = !dark;
    localStorage.setItem('darkMode', String(dark));
    apply();
  }

  function apply() {
    document.documentElement.classList.toggle('dark', dark);
  }

  return {
    get dark() {
      return dark;
    },
    init,
    toggle,
  };
}

export const theme = createThemeState();
