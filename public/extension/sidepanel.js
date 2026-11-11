(() => {
  const $ = (id) => document.getElementById(id);
  const listen = $('listen-button');
  const stop = $('stop-button');
  const title = $('meeting-title');
  const status = $('meeting-status');
  const liveState = $('live-state');
  const transcript = $('transcript');
  const waveform = $('wave');
  const scratchpad = $('scratchpad');
  const warehouseLink = $('warehouse-link');
  const warehouseUrl = $('warehouse-url');
  const currentSpeaker = $('current-speaker');

  let activeTabId;
  let meetingTitle = 'Google Meet';
  let speaker = 'Guest';
  let recorder;
  let audioContext;
  let sourceStream;
  let mixedStream;
  let audioChunks = [];
  let startedAt = 0;
  let elapsedTimer;
  let dbPromise;

  const send = (message) => new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(response);
    });
  });

  const openDb = () => {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('kosh-local-archive', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Kosh local archive could not be opened.'));
      request.onupgradeneeded = () => reject(new Error('Open Kosh once to initialize its local archive, then try again.'));
    });
    return dbPromise;
  };

  const putLocal = async (store, value) => {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readwrite');
      transaction.objectStore(store).put(value);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error('Could not save this meeting locally.'));
      transaction.onabort = () => reject(transaction.error || new Error('Local save was cancelled.'));
    });
  };

  const id = () => crypto.randomUUID ? crypto.randomUUID() : `kosh-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const formatTime = (seconds) => {
    const value = Math.max(0, Math.floor(seconds));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  };

  function addTranscript(text, start, end, who) {
    const empty = transcript.querySelector('.empty');
    if (empty) empty.remove();
    const paragraph = document.createElement('p');
    paragraph.className = 'line';
    paragraph.dataset.start = String(start);
    paragraph.dataset.end = String(end);
    const label = document.createElement('span');
    label.className = 'speaker';
    label.textContent = who || 'Guest';
    const content = document.createElement('span');
    content.innerHTML = `<span class="time">${formatTime(start)}</span>`;
    content.append(document.createTextNode(text));
    paragraph.append(label, content);
    transcript.append(paragraph);
    transcript.scrollTop = transcript.scrollHeight;
  }

  const setListening = (value) => {
    listen.disabled = value || !Number.isInteger(activeTabId);
    stop.disabled = !value;
    waveform.classList.toggle('active', value);
    liveState.classList.toggle('active', value);
    liveState.textContent = value ? 'Listening' : 'Ready';
    if (value) transcript.dataset.captureStarted = String(Date.now());
  };

  function configureWarehouseLink() {
    const fallback = 'http://localhost:5173/';
    let address = fallback;
    try { address = new URL(warehouseUrl.value || fallback).toString(); } catch { warehouseUrl.value = fallback; }
    warehouseLink.href = address;
    localStorage.setItem('kosh-warehouse-url', address);
  }

  async function refreshTab() {
    try {
      const response = await send({ type: 'KOSH_MEETING_TAB' });
      activeTabId = response?.ok ? response.tabId : undefined;
      meetingTitle = response?.title || 'Google Meet';
      title.textContent = activeTabId ? meetingTitle : 'No Google Meet tab detected';
      status.textContent = activeTabId ? 'Ready to capture meeting and microphone audio.' : 'Open meet.google.com in the active tab to begin.';
      listen.disabled = !Number.isInteger(activeTabId);
      if (activeTabId) chrome.tabs.sendMessage(activeTabId, { type: 'KOSH_REQUEST_SPEAKER' }, () => void chrome.runtime.lastError);
    } catch (error) {
      status.textContent = error.message || 'Could not inspect the active tab.';
    }
  }

  async function startListening() {
    listen.disabled = true;
    status.textContent = 'Connecting to meeting audio…';
    try {
      const capture = await send({ type: 'KOSH_CAPTURE_START', tabId: activeTabId });
      if (!capture?.ok) throw new Error(capture?.error || 'Chrome could not capture this meeting tab.');
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error('Web Audio is not supported by this browser.');
      audioContext = new AudioContextClass();
      const tabStream = await navigator.mediaDevices.getUserMedia({
        audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: capture.streamId } },
        video: false,
      });
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const tabSource = audioContext.createMediaStreamSource(tabStream);
      const micSource = audioContext.createMediaStreamSource(micStream);
      const destination = audioContext.createMediaStreamDestination();
      tabSource.connect(destination);
      micSource.connect(destination);
      sourceStream = new MediaStream([...tabStream.getTracks(), ...micStream.getTracks()]);
      mixedStream = destination.stream;
      // Keep tab playback alive while recording it; the captured tab is otherwise muted by Chrome.
      const playback = audioContext.createMediaStreamDestination();
      tabSource.connect(playback);
      const playbackAudio = new Audio();
      playbackAudio.srcObject = playback.stream;
      playbackAudio.play().catch(() => {});
      sourceStream.__koshPlaybackAudio = playbackAudio;
      sourceStream.__koshMicStream = micStream;
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      recorder = new MediaRecorder(mixedStream, { mimeType: mime });
      audioChunks = [];
      recorder.ondataavailable = (event) => { if (event.data.size) audioChunks.push(event.data); };
      recorder.onerror = () => { status.textContent = 'Recording encountered an error.'; void stopListening(); };
      recorder.start(1000);
      startedAt = Date.now();
      setListening(true);
      status.textContent = 'Meeting tab and microphone audio are being captured on this device.';
      elapsedTimer = setInterval(() => { liveState.textContent = `Listening · ${formatTime((Date.now() - startedAt) / 1000)}`; }, 1000);
      transcript.querySelector('.empty')?.remove();
    } catch (error) {
      await releaseAudio();
      listen.disabled = false;
      status.textContent = error.message || 'Could not start local audio capture.';
    }
  }

  async function stopListening() {
    if (!recorder || recorder.state === 'inactive') return;
    stop.disabled = true;
    status.textContent = 'Saving this meeting to Kosh…';
    const completed = new Promise((resolve) => { recorder.addEventListener('stop', resolve, { once: true }); });
    recorder.stop();
    await completed;
    const blob = new Blob(audioChunks, { type: recorder.mimeType || 'audio/webm' });
    await releaseAudio();
    setListening(false);
    try {
      if (!blob.size) throw new Error('No meeting audio was captured.');
      const now = new Date().toISOString();
      const meetingId = id();
      const audioId = id();
      const duration = Math.max(0, (Date.now() - startedAt) / 1000);
      const scratch = scratchpad.value.trim();
      const meeting = {
        id: meetingId,
        title: meetingTitle.replace(/\s+-\s+Google Meet.*$/i, '').trim() || 'Google Meet meeting',
        meetingDate: new Date(startedAt).toISOString(),
        durationSeconds: duration,
        preview: 'Meeting recording captured locally. Open the record to add its transcript and summary.',
        summary: '', actionItems: [], notes: scratch, transcript: [], tagIds: [], audioId,
        transcriptionStatus: 'queued', createdAt: now, updatedAt: now,
      };
      const audioFile = {
        id: audioId, meetingId, name: `${meeting.title} · ${new Date(startedAt).toLocaleString()}.webm`,
        mimeType: blob.type || 'audio/webm', durationSeconds: duration, file: blob, createdAt: now, updatedAt: now,
      };
      await putLocal('audioFiles', audioFile);
      await putLocal('meetings', meeting);
      status.textContent = 'Saved to the local Kosh warehouse. Audio transcription can be started from the warehouse.';
      addTranscript('Recording saved locally. Open the warehouse to transcribe and review this meeting.', duration, duration, 'Kosh');
    } catch (error) {
      status.textContent = error.message || 'Could not save the meeting in the Kosh local archive.';
    }
  }

  async function releaseAudio() {
    clearInterval(elapsedTimer);
    if (sourceStream) sourceStream.getTracks().forEach((track) => track.stop());
    sourceStream?.__koshMicStream?.getTracks().forEach((track) => track.stop());
    if (mixedStream) mixedStream.getTracks().forEach((track) => track.stop());
    sourceStream?.__koshPlaybackAudio?.pause();
    if (audioContext && audioContext.state !== 'closed') await audioContext.close().catch(() => {});
    sourceStream = mixedStream = audioContext = recorder = null;
  }

  listen.addEventListener('click', () => void startListening());
  stop.addEventListener('click', () => void stopListening());
  warehouseUrl.value = localStorage.getItem('kosh-warehouse-url') || 'http://localhost:5173/';
  warehouseUrl.addEventListener('change', configureWarehouseLink);
  warehouseUrl.addEventListener('input', configureWarehouseLink);
  configureWarehouseLink();
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'KOSH_SPEAKER') {
      speaker = message.speaker || 'Guest';
      currentSpeaker.textContent = speaker;
    }
  });

  scratchpad.value = localStorage.getItem('kosh-meeting-scratchpad') || '';
  scratchpad.addEventListener('input', () => localStorage.setItem('kosh-meeting-scratchpad', scratchpad.value));
  refreshTab();
  chrome.tabs.onActivated.addListener(() => refreshTab());
  chrome.tabs.onUpdated.addListener((tabId, change) => { if (tabId === activeTabId && change.status === 'complete') refreshTab(); });
})();
