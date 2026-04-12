function createSidebarState() {
  let collapsed = $state(false);
  let mobileOpen = $state(false);

  function init() {
    const stored = localStorage.getItem('sidebarCollapsed');
    if (stored !== null) {
      collapsed = stored === 'true';
    }
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
