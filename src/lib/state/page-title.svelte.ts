function createPageTitleState() {
  let title = $state('');

  return {
    get title() {
      return title;
    },
    set(value: string) {
      title = value;
    },
  };
}

export const pageTitle = createPageTitleState();
