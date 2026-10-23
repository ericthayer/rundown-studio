/**
 * Marks the pinned ask dock `.lifted` only while list content sits hidden under it. Wide screens scroll
 * the visible list itself; narrower ones scroll the page. Checks run once per frame on scroll, resize
 * and list changes. Returns a cleanup.
 */
export function watchDockLift(dock: HTMLElement, lists: readonly HTMLElement[]): () => void {
  let frame = 0;
  const below = (el: Element): boolean => el.scrollTop + el.clientHeight < el.scrollHeight - 1;
  const check = (): void => {
    frame = 0;
    const list = lists.find((l) => !l.closest('[hidden]'));
    const own = list && getComputedStyle(list).overflowY !== 'visible';
    const scroller = own ? list : document.scrollingElement;
    dock.classList.toggle('lifted', Boolean(scroller && below(scroller)));
  };
  const schedule = (): void => { frame ||= requestAnimationFrame(check); };

  const opts: AddEventListenerOptions = { passive: true };
  window.addEventListener('scroll', schedule, opts);
  lists.forEach((l) => l.addEventListener('scroll', schedule, opts));
  const sizes = new ResizeObserver(schedule);
  sizes.observe(document.documentElement);
  lists.forEach((l) => sizes.observe(l));
  // Rows added, removed or expanded, and the projects/decisions views swapping via `hidden`.
  const rows = new MutationObserver(schedule);
  lists.forEach((l) => {
    rows.observe(l, { childList: true, subtree: true });
    if (l.parentElement) rows.observe(l.parentElement, { attributes: true, attributeFilter: ['hidden'] });
  });
  schedule();

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('scroll', schedule);
    lists.forEach((l) => l.removeEventListener('scroll', schedule));
    sizes.disconnect();
    rows.disconnect();
  };
}
