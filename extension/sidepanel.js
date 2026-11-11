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
  const downloadRecording = $('download-recording');
  let downloadUrl;

  let activeTabId;
  let meetingTitle = 'Google Meet';
  let speaker = 'Guest';
  let currentMeetingId;
  let latestNotes = '';
  let transcriptSegments = [];
  let lastKnownSpeaker = 'Guest';
  let recorder;
  let audioContext;
  let sourceStream;
  let micStream;
  let playbackAudio;
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
      const request = indexedDB.open('kosh-extension-archive', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const storeName of ['meetings', 'audioFiles']) {
          if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Kosh extension archive could not be opened.'));
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

  function addTranscript(text, start, who) {
    transcript.querySelector('.empty')?.remove();
    const paragraph = document.createElement('p');
    paragraph.className = 'line';
    const label = document.createElement('span');
    label.className = 'speaker';
    label.textContent = who || 'Guest';
    const content = document.createElement('span');
    const timestamp = document.createElement('span');
    timestamp.className = 'time';
    timestamp.textContent = formatTime(start);
    content.append(timestamp, document.createTextNode(text));
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
  };

  function configureWarehouseLink() {
    const fallback = 'http://localhost:5173/';
    let address = fallback;
    try {
      const parsed = new URL(warehouseUrl.value || fallback);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Enter an HTTP or HTTPS address.');
      address = parsed.toString();
      warehouseUrl.setCustomValidity('');
    } catch {
      warehouseUrl.setCustomValidity('Enter a valid warehouse address.');
      address = fallback;
    }
    warehouseLink.href = address;
    try { localStorage.setItem('kosh-warehouse-url', address); } catch {}
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
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const tabSource = audioContext.createMediaStreamSource(tabStream);
      const micSource = audioContext.createMediaStreamSource(micStream);
      const destination = audioContext.createMediaStreamDestination();
      tabSource.connect(destination);
      micSource.connect(destination);
      sourceStream = tabStream;
      mixedStream = destination.stream;
      const playback = audioContext.createMediaStreamDestination();
      tabSource.connect(playback);
      playbackAudio = new Audio();
      playbackAudio.srcObject = playback.stream;
      playbackAudio.play().catch(() => {});
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
    const activeRecorder = recorder;
    const completed = new Promise((resolve) => { activeRecorder.addEventListener('stop', resolve, { once: true }); });
    activeRecorder.stop();
    await completed;
    const blob = new Blob(audioChunks, { type: activeRecorder.mimeType || 'audio/webm' });
    const duration = Math.max(0, (Date.now() - startedAt) / 1000);
    await releaseAudio();
    setListening(false);
    try {
      if (!blob.size) throw new Error('No meeting audio was captured.');
      const now = new Date().toISOString();
      const meetingId = id();
      const audioId = id();
      const scratch = latestNotes || scratchpad.value.trim();
      const savedSegments = transcriptSegments.map((segment) => ({ ...segment }));
      const meeting = {
        id: meetingId,
        title: meetingTitle.replace(/\s+-\s+Google Meet.*$/i, '').trim() || 'Google Meet meeting',
        meetingDate: new Date(startedAt).toISOString(), durationSeconds: duration,
        preview: 'Meeting recording captured locally. Transcribe from Kosh’s audio intake to add searchable speech text.',
        summary: '', actionItems: [], notes: scratch, transcript: savedSegments, tagIds: [], audioId,
        transcriptionStatus: 'queued', createdAt: now, updatedAt: now,
      };
      const audioFile = {
        id: audioId, meetingId, name: `${meeting.title} · ${new Date(startedAt).toLocaleString()}.webm`,
        mimeType: blob.type || 'audio/webm', durationSeconds: duration, file: blob, createdAt: now, updatedAt: now,
      };
      await putLocal('audioFiles', audioFile);
      await putLocal('meetings', meeting);
      currentMeetingId = meetingId;
      transcriptSegments = savedSegments;
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      downloadUrl = URL.createObjectURL(blob);
      downloadRecording.href = downloadUrl;
      downloadRecording.download = `${meeting.title.replace(/[<>:"/\\|?*]/g, '-') || 'Kosh meeting'}-${new Date(startedAt).toISOString().slice(0, 10)}.webm`;
      downloadRecording.hidden = false;
      status.textContent = 'Recording saved in this Chrome profile. Download it to add it to the Kosh warehouse.';
      addTranscript('Recording saved locally. Download the audio file to add it to the Kosh warehouse for transcription.', 0, 'Kosh');
    } catch (error) {
      status.textContent = error.message || 'Could not save the meeting in the local archive.';
    }
  }

  async function releaseAudio() {
    clearInterval(elapsedTimer);
    if (sourceStream) sourceStream.getTracks().forEach((track) => track.stop());
    if (micStream) micStream.getTracks().forEach((track) => track.stop());
    if (mixedStream) mixedStream.getTracks().forEach((track) => track.stop());
    playbackAudio?.pause();
    if (audioContext && audioContext.state !== 'closed') await audioContext.close().catch(() => {});
    sourceStream = micStream = mixedStream = audioContext = recorder = playbackAudio = null;
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
      lastKnownSpeaker = speaker;
      currentSpeaker.textContent = speaker;
      if (startedAt) {
        const elapsed = (Date.now() - startedAt) / 1000;
        const current = transcriptSegments[transcriptSegments.length - 1];
        if (current && current.speaker !== speaker && !current.text.trim()) transcriptSegments.pop();
        transcriptSegments.push({ id: `speaker-${Date.now()}`, startSeconds: elapsed, endSeconds: elapsed, speaker, text: '' });
      }
      if (currentMeetingId) {
        void openDb().then((db) => new Promise((resolve, reject) => {
          const transaction = db.transaction('meetings', 'readwrite');
          const store = transaction.objectStore('meetings');
          const request = store.get(currentMeetingId);
          request.onsuccess = () => {
            if (!request.result) return;
            const meeting = request.result;
            store.put({ ...meeting, transcript: [{ id: `speaker-${Date.now()}`, startSeconds: (Date.now() - startedAt) / 1000, endSeconds: (Date.now() - startedAt) / 1000, speaker, text: '' }], updatedAt: new Date().toISOString() });
          };
          transaction.oncomplete = resolve;
          transaction.onerror = () => reject(transaction.error);
        })).catch(() => {});
      }
    }
  });
  scratchpad.value = localStorage.getItem('kosh-meeting-scratchpad') || '';
  latestNotes = scratchpad.value;
  scratchpad.addEventListener('input', () => {
    latestNotes = scratchpad.value;
    try { localStorage.setItem('kosh-meeting-scratchpad', scratchpad.value); } catch {}
    if (!currentMeetingId) return;
    void openDb().then((db) => new Promise((resolve, reject) => {
      const transaction = db.transaction('meetings', 'readwrite');
      const store = transaction.objectStore('meetings');
      const request = store.get(currentMeetingId);
      request.onsuccess = () => {
        if (request.result) store.put({ ...request.result, notes: latestNotes, updatedAt: new Date().toISOString() });
      };
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    })).catch(() => {});
  });
  refreshTab();
  chrome.tabs.onActivated.addListener(() => refreshTab());
  chrome.tabs.onUpdated.addListener((tabId, change) => { if (tabId === activeTabId && change.status === 'complete') refreshTab(); });
})();
