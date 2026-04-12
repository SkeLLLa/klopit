function createSidebarState() {
  let collapsed = $state(
    typeof localStorage !== 'undefined' &&
      localStorage.getItem('sidebarCollapsed') === 'true',
  );
  let mobileOpen = $state(false);

  function init() {
    // Remove the pre-hydration CSS hint now that Svelte controls the inline styles
    delete document.documentElement.dataset.sidebarCollapsed;
  }

  function toggleCollapsed() {
    collapsed = !collapsed;
    localStorage.setItem('sidebarCollapsed', String(collapsed));
  }

  function toggleMobile() {
    mobileOpen = !mobileOpen;
  }

  function closeMobile() {
    mobileOpen = false;
  }

  return {
    get collapsed() {
      return collapsed;
    },
    get mobileOpen() {
      return mobileOpen;
    },
    init,
    toggleCollapsed,
    toggleMobile,
    closeMobile,
  };
}

export const sidebar = createSidebarState();
