const extensionApi = globalThis.chrome;

extensionApi.runtime.onInstalled.addListener(() => {
  if (extensionApi.sidePanel?.setPanelBehavior) {
    void extensionApi.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

extensionApi.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type === 'KOSH_CAPTURE_START') {
    const tabId = Number(message.tabId);
    if (!Number.isInteger(tabId)) {
      respond({ ok: false, error: 'The active meeting tab could not be identified.' });
      return;
    }
    extensionApi.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
      const error = extensionApi.runtime.lastError;
      if (error || !streamId) {
        respond({ ok: false, error: error?.message || 'Chrome could not capture this tab.' });
        return;
      }
      respond({ ok: true, streamId });
    });
    return true;
  }

  if (message?.type === 'KOSH_MEETING_TAB') {
    extensionApi.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const tab = tabs[0];
      respond({
        ok: Boolean(tab?.id && /^(https?:):\/\/meet\.google\.com\//i.test(tab.url || '')),
        tabId: tab?.id,
        title: tab?.title || 'Google Meet',
        url: tab?.url || '',
      });
    });
    return true;
  }
});
