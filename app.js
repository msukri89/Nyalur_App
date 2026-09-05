// ==========================================
// IMPORT MODUL UTAMA
// ==========================================
import { getTransfers, clearTransfers, addTransfer } from './lib/history-db.js';
import { peerManager } from './lib/peer-manager.js';
import { sendFiles, receiveFiles, downloadFile, requestNotificationPermission } from './lib/transfer-engine.js';
import { formatFileSize, formatDate, formatSpeed } from './lib/utils.js';
import QRCode from 'qrcode'; 

document.addEventListener('DOMContentLoaded', async () => {
  // ==========================================
  // VARIABEL STATE & ELEMEN DOM
  // ==========================================
  let currentView = 'home';
  let deviceName = localStorage.getItem('nyalur-device-name') || 'Perangkat';
  let selectedFiles = [];
  let receiverInstance = null;
  let incomingOffer = null;

  // Daftar Halaman (Views)
  const views = {
    home: document.getElementById('view-home'),
    send: document.getElementById('view-send'),
    receive: document.getElementById('view-receive')
  };

  // Elemen Halaman Home
  const domHome = {
    navSend: document.getElementById('nav-send'),
    navReceive: document.getElementById('nav-receive'),
    btnBacks: document.querySelectorAll('.btn-back'),
    
    btnEditName: document.getElementById('btn-edit-name'),
    btnSaveName: document.getElementById('btn-save-name'),
    inputDeviceName: document.getElementById('input-device-name'),
    displayDeviceName: document.getElementById('display-device-name'),
    modeDisplay: document.getElementById('name-display-mode'),
    modeEdit: document.getElementById('name-edit-mode'),

    historyList: document.getElementById('history-list'),
    historyEmpty: document.getElementById('history-empty'),
    historyCount: document.getElementById('history-count'),
    btnClearHistory: document.getElementById('btn-clear-history')
  };

  // Elemen Halaman Kirim (Send)
  const domSend = {
    stateIdle: document.getElementById('send-state-idle'),
    stateTransferring: document.getElementById('send-state-transferring'),
    dropZone: document.getElementById('drop-zone'),
    fileInput: document.getElementById('file-input'),
    fileList: document.getElementById('selected-files-list'),
    inputCode: document.getElementById('input-room-code'),
    btnConnect: document.getElementById('btn-connect-send'),
    btnScanQr: document.getElementById('btn-scan-qr'),
    
    progressCircle: document.getElementById('send-progress-circle'),
    progressBar: document.getElementById('send-progress-bar'),
    fileName: document.getElementById('send-file-name'),
    statsBytes: document.getElementById('send-bytes'),
    statsSpeed: document.getElementById('send-speed')
  };

  // Elemen Halaman Terima (Receive)
  const domRecv = {
    stateWaiting: document.getElementById('receive-state-waiting'),
    stateIncoming: document.getElementById('receive-state-incoming'),
    stateTransferring: document.getElementById('receive-state-transferring'),
    
    roomCodeStr: document.getElementById('display-room-code'),
    qrContainer: document.getElementById('qr-container'),
    qrImage: document.getElementById('qr-image'),
    btnCopy: document.getElementById('btn-copy-code'),
    
    senderName: document.getElementById('incoming-sender-name'),
    incomingFileList: document.getElementById('incoming-file-list'),
    btnAccept: document.getElementById('btn-accept'),
    btnReject: document.getElementById('btn-reject'),

    progressCircle: document.getElementById('recv-progress-circle'),
    progressBar: document.getElementById('recv-progress-bar'),
    fileName: document.getElementById('recv-file-name'),
    statsBytes: document.getElementById('recv-bytes'),
    statsSpeed: document.getElementById('recv-speed')
  };

  // ==========================================
  // INISIALISASI AWAL
  // ==========================================
  domHome.displayDeviceName.textContent = deviceName;
  await loadHistory();
  handleHashChange(); // Cek URL (apakah sedang di #send atau #receive)

  // ==========================================
  // LOGIKA NAVIGASI (ROUTING)
  // ==========================================
  window.addEventListener('hashchange', handleHashChange);
  
  domHome.navSend.addEventListener('click', () => navigate('send'));
  domHome.navReceive.addEventListener('click', () => navigate('receive'));
  domHome.btnBacks.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target.getAttribute('data-target');
      navigate(target);
    });
  });

  function navigate(view) {
    window.location.hash = view === 'home' ? '' : view;
  }

  function handleHashChange() {
    const hash = window.location.hash.slice(1);
    const targetView = (hash === 'send' || hash === 'receive') ? hash : 'home';
    
    // Matikan WebRTC jika kembali ke home
    if (targetView === 'home' && currentView !== 'home') {
      peerManager.destroy(); 
    }

    // Tampilkan halaman yang dipilih, sembunyikan yang lain
    Object.keys(views).forEach(k => {
      if(k === targetView) {
        views[k].classList.remove('hidden');
        views[k].classList.add('animate-fade-in');
      } else {
        views[k].classList.add('hidden');
        views[k].classList.remove('animate-fade-in');
      }
    });

    currentView = targetView;
    
    if (targetView === 'send') initSendView();
    if (targetView === 'receive') initReceiveView();
    if (targetView === 'home') loadHistory();
  }

  // ==========================================
  // LOGIKA HALAMAN HOME (UBAH NAMA & RIWAYAT)
  // ==========================================
  domHome.btnEditName.addEventListener('click', () => {
    domHome.inputDeviceName.value = deviceName;
    domHome.modeDisplay.classList.add('hidden');
    domHome.modeEdit.classList.remove('hidden');
    domHome.inputDeviceName.focus();
  });

  domHome.btnSaveName.addEventListener('click', saveDeviceName);
  domHome.inputDeviceName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveDeviceName();
    if (e.key === 'Escape') {
      domHome.modeEdit.classList.add('hidden');
      domHome.modeDisplay.classList.remove('hidden');
    }
  });

  domHome.btnClearHistory.addEventListener('click', async () => {
    if(confirm('Hapus semua riwayat transfer?')) {
      await clearTransfers();
      await loadHistory();
    }
  });

  function saveDeviceName() {
    const val = domHome.inputDeviceName.value.trim().substring(0, 20);
    if (val) {
      deviceName = val;
      localStorage.setItem('nyalur-device-name', val);
      domHome.displayDeviceName.textContent = val;
      peerManager.setDeviceName(val); 
    }
    domHome.modeEdit.classList.add('hidden');
    domHome.modeDisplay.classList.remove('hidden');
  }

  async function loadHistory() {
    try {
      const history = await getTransfers(20);
      domHome.historyList.innerHTML = '';
      domHome.historyCount.textContent = `(${history.length})`;

      if (history.length === 0) {
        domHome.historyEmpty.classList.remove('hidden');
      } else {
        domHome.historyEmpty.classList.add('hidden');
        history.forEach(record => {
          const fileNames = record.files ? record.files.map(f => f.name).join(', ') : 'File';
          const isSent = record.direction === 'sent';
          
          const div = document.createElement('div');
          div.className = 'history-item';
          div.innerHTML = `
            <div style="color: var(--${isSent ? 'green' : 'orange'}); font-size: 1.25rem;">
              ${isSent ? '↑' : '↓'}
            </div>
            <div style="flex:1; min-width:0;">
              <p class="truncate" style="font-size:0.875rem;">${fileNames}</p>
              <p class="text-muted" style="font-size:0.75rem;">
                ${isSent ? '→' : '←'} ${record.peerName || '—'} · ${formatFileSize(record.totalSize)} · ${formatDate(record.timestamp)}
              </p>
            </div>
            <span style="font-size:0.75rem; color: var(--${record.status === 'completed' ? 'green' : 'error'})">
              ${record.status === 'completed' ? 'Berhasil' : 'Gagal'}
            </span>
          `;
          domHome.historyList.appendChild(div);
        });
      }
    } catch (e) {
      console.error('Gagal memuat riwayat', e);
    }
  }

  // ==========================================
  // LOGIKA HALAMAN KIRIM (SEND)
  // ==========================================
  function setSendState(state) {
    domSend.stateIdle.classList.add('hidden');
    domSend.stateTransferring.classList.add('hidden');

    if (state === 'idle' || state === 'connecting') {
      domSend.stateIdle.classList.remove('hidden');
      domSend.inputCode.disabled = (state === 'connecting');
      domSend.btnConnect.disabled = (state === 'connecting' || selectedFiles.length === 0 || domSend.inputCode.value.length !== 4);
      domSend.btnConnect.textContent = state === 'connecting' ? 'Menghubungkan...' : 'Kirim';
    } else if (state === 'transferring') {
      domSend.stateTransferring.classList.remove('hidden');
    }
  }

  function renderSelectedFiles() {
    domSend.fileList.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
      const div = document.createElement('div');
      div.className = 'history-item mt-2';
      div.innerHTML = `
        <div style="flex:1; min-width:0;">
          <p class="truncate" style="font-size:0.875rem;">${file.name}</p>
          <p class="text-muted" style="font-size:0.75rem;">${formatFileSize(file.size)}</p>
        </div>
        <button class="btn-text text-error remove-file" data-index="${index}" style="font-size:1.2rem;">✕</button>
      `;
      domSend.fileList.appendChild(div);
    });

    document.querySelectorAll('.remove-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'));
        selectedFiles.splice(idx, 1);
        renderSelectedFiles();
      });
    });

    setSendState('idle');
  }

  async function initSendView() {
    peerManager.init();
    requestNotificationPermission();
    selectedFiles = [];
    domSend.inputCode.value = '';
    renderSelectedFiles();
    setSendState('idle');
  }

  // Event Input File Kirim
  domSend.dropZone.addEventListener('click', () => domSend.fileInput.click());
  domSend.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      selectedFiles = [...selectedFiles, ...Array.from(e.target.files)];
      renderSelectedFiles();
    }
  });

  domSend.inputCode.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 4);
    setSendState('idle');
  });

  domSend.btnScanQr.addEventListener('click', async () => {
    alert("Untuk versi Vanilla ini, silakan ketik 4 digit kode Room secara manual.");
  });

  // Tombol Kirim Mulai
  domSend.btnConnect.addEventListener('click', async () => {
    const code = domSend.inputCode.value;
    setSendState('connecting');
    try {
      const conn = await peerManager.connectToRoom(code);
      setSendState('transferring');
      
      const result = await sendFiles(conn, selectedFiles, (progress) => {
        const percent = Math.round(progress.totalProgress * 100);
        domSend.progressCircle.textContent = `${percent}%`;
        domSend.progressBar.style.width = `${percent}%`;
        domSend.fileName.textContent = progress.fileName;
        domSend.statsBytes.textContent = `${formatFileSize(progress.totalSent)} / ${formatFileSize(progress.totalSize)}`;
        domSend.statsSpeed.textContent = formatSpeed(progress.speed);
      });

      await addTransfer({ direction: 'sent', peerName: code, files: result.files, totalSize: result.totalSize, duration: result.duration, status: 'completed' });
      alert('File berhasil dikirim!'); 
      navigate('home');

    } catch (err) {
      alert('Transfer gagal: ' + err.message);
      setSendState('idle');
    }
  });

  // ==========================================
  // LOGIKA HALAMAN TERIMA (RECEIVE)
  // ==========================================
  function setReceiveState(state) {
    domRecv.stateWaiting.classList.add('hidden');
    domRecv.stateIncoming.classList.add('hidden');
    domRecv.stateTransferring.classList.add('hidden');

    if (state === 'waiting') domRecv.stateWaiting.classList.remove('hidden');
    else if (state === 'incoming') domRecv.stateIncoming.classList.remove('hidden');
    else if (state === 'receiving') domRecv.stateTransferring.classList.remove('hidden');
  }

  async function initReceiveView() {
    setReceiveState('waiting');
    domRecv.roomCodeStr.textContent = '----';
    domRecv.qrContainer.classList.add('hidden');

    try {
      const result = await peerManager.initAsReceiver();
      domRecv.roomCodeStr.textContent = result.roomCode.split('').join(' ');
      
      try {
        const qrDataUrl = await QRCode.toDataURL(result.roomCode, { width: 196, margin: 2, color: { dark: '#FF6B00', light: '#0F172A' }});
        domRecv.qrImage.src = qrDataUrl;
        domRecv.qrContainer.classList.remove('hidden');
      } catch (err) {
        console.warn("Library QRCode belum termuat sempurna");
      }

      peerManager.onIncomingConnection((conn) => {
        receiverInstance = receiveFiles(conn, 
          // 1. Saat ada yang mau kirim file (Offer)
          (offerData) => {
            incomingOffer = offerData;
            domRecv.senderName.textContent = offerData.deviceName || 'Pengirim';
            
            domRecv.incomingFileList.innerHTML = '';
            offerData.files.forEach(f => {
              const p = document.createElement('p');
              p.className = 'text-sm text-left truncate';
              p.textContent = `• ${f.name} (${formatFileSize(f.size)})`;
              domRecv.incomingFileList.appendChild(p);
            });
            setReceiveState('incoming');
          },
          // 2. Saat proses transfer berlangsung (Progress)
          (progress) => {
            const percent = Math.round(progress.totalProgress * 100);
            domRecv.progressCircle.textContent = `${percent}%`;
            domRecv.progressBar.style.width = `${percent}%`;
            domRecv.fileName.textContent = progress.fileName;
            domRecv.statsBytes.textContent = `${formatFileSize(progress.totalReceived)} / ${formatFileSize(progress.totalSize)}`;
            domRecv.statsSpeed.textContent = formatSpeed(progress.speed);
          },
          // 3. Saat 1 file selesai (langsung unduh)
          (fileInfo, blob) => {
            downloadFile(blob, fileInfo.name);
          },
          // 4. Saat semua file selesai
          async (resultData) => {
            await addTransfer({ direction: 'received', peerName: incomingOffer?.deviceName, files: resultData.files, totalSize: resultData.totalSize, duration: resultData.duration, status: 'completed' });
            alert('File berhasil diterima dan diunduh!');
            navigate('home');
          }
        );
      });

      requestNotificationPermission();
    } catch (e) {
      alert('Gagal membuat room: ' + e.message);
      navigate('home');
    }
  }

  // Tombol Interaksi Halaman Terima
  domRecv.btnCopy.addEventListener('click', () => {
    const code = domRecv.roomCodeStr.textContent.replace(/\s/g, '');
    navigator.clipboard.writeText(code).then(() => {
      domRecv.btnCopy.textContent = 'Tersalin!';
      setTimeout(() => domRecv.btnCopy.textContent = 'Salin Kode', 2000);
    });
  });

  domRecv.btnAccept.addEventListener('click', () => {
    if (receiverInstance) {
      receiverInstance.accept();
      setReceiveState('receiving');
    }
  });

  domRecv.btnReject.addEventListener('click', () => {
    if (receiverInstance) {
      receiverInstance.reject();
      setReceiveState('waiting');
    }
  });
// ==========================================
  // REGISTRASI SERVICE WORKER (UNTUK PWA / OFFLINE)
  // ==========================================
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        // Sesuaikan path '/Nyalur/sw.js' dengan lokasi file Anda
        await navigator.serviceWorker.register('/Nyalur/sw.js', {
          scope: '/Nyalur/'
        });
        console.log('Service Worker siap - Aplikasi bisa offline!');
      } catch (err) {
        console.warn('Service Worker gagal didaftarkan:', err);
      }
    });
  }
});
