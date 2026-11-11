(() => {
  if (globalThis.__koshMeetObserver) return;
  globalThis.__koshMeetObserver = true;

  const cleanName = (value) => {
    if (!value) return '';
    const cleaned = value
      .replace(/\b(microphone|speaking|muted|unmuted|presenting|pin)\b/gi, '')
      .replace(/[·,].*$/, '')
      .trim();
    return cleaned && cleaned.length < 80 ? cleaned : '';
  };

  const findSpeaker = () => {
    const activeTile = document.querySelector(
      '[data-speaking="true"], [data-is-speaking="true"], [data-speaking="1"]',
    );
    if (!activeTile) return 'Guest';
    const labelled = activeTile.getAttribute('aria-label') ||
      activeTile.querySelector('[aria-label]')?.getAttribute('aria-label') ||
      activeTile.querySelector('.notranslate')?.textContent;
    return cleanName(labelled) || 'Guest';
  };

  let previous = '';
  const emitSpeaker = () => {
    const speaker = findSpeaker();
    if (speaker === previous) return;
    previous = speaker;
    chrome.runtime.sendMessage({ type: 'KOSH_SPEAKER', speaker });
  };

  const observer = new MutationObserver(emitSpeaker);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-speaking', 'data-is-speaking', 'aria-label'],
  });
  emitSpeaker();
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'KOSH_REQUEST_SPEAKER') emitSpeaker();
  });
})();
