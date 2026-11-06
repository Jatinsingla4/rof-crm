import type { Page } from '@playwright/test';

// The CRM asks "are you sure?" with an in-page box (Utils.ask), not a native confirm(). This answers OK for it the way the old
// page.on('dialog', accept) did, and reports the question text. It clicks the real OK button, so the box itself is exercised.
export async function autoAsk(page: Page, onQuestion?: (message: string) => void) {
  await page.exposeFunction('__askSeen', (message: string) => { onQuestion?.(message); });
  await page.addInitScript(() => {
    const seen = new WeakSet<Element>();
    const look = () => {
      const box = document.getElementById('rof-ask');
      if (!box || seen.has(box)) return;
      seen.add(box);
      (window as any).__askSeen(box.querySelector('[data-ask-msg]')?.textContent || '');
      setTimeout(() => (document.getElementById('rof-ask-ok') as HTMLElement | null)?.click(), 0);
    };
    new MutationObserver(look).observe(document, { childList: true, subtree: true });
  });
}
