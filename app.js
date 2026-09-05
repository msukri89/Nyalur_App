import { getTransfers, clearTransfers } from './lib/history-db.js';
import { formatFileSize, formatDate } from './lib/utils.js';
// Pastikan path import ke lib Anda sesuai dengan struktur folder Anda.

document.addEventListener('DOMContentLoaded', async () => {
  // === STATE & DOM ELEMENTS ===
  let currentView = 'home';
  let deviceName = localStorage.getItem('nyalur-device-name') || 'Perangkat';

  const views = {
    home: document.getElementById('view-home'),
    send: document.getElementById('view-send'),
    receive: document.getElementById('view-receive')
  };

  const dom = {
    // Navigasi
    navSend: document.getElementById('nav-send'),
    navReceive: document.getElementById('nav-receive'),
    btnBacks: document.querySelectorAll('.btn-back'),
    
    // Nama Perangkat
    btnEditName: document.getElementById('btn-edit-name'),
    btnSaveName: document.getElementById('btn-save-name'),
    inputDeviceName: document.getElementById('input-device-name'),
    displayDeviceName: document.getElementById('display-device-name'),
    modeDisplay: document.getElementById('name-display-mode'),
    modeEdit: document.getElementById('name-edit-mode'),

    // Riwayat
    historyList: document.getElementById('history-list'),
    historyEmpty: document.getElementById('history-empty'),
    historyCount: document.getElementById('history-count'),
    btnClearHistory: document.getElementById('btn-clear-history')
  };

  // === INISIALISASI TAMPILAN AWAL ===
  dom.displayDeviceName.textContent = deviceName;
  await loadHistory();
  handleHashChange(); // Cek hash URL (misal: mysite.com/#send)

  // === EVENT LISTENERS (ROUTING) ===
  window.addEventListener('hashchange', handleHashChange);
  
  dom.navSend.addEventListener('click', () => navigate('send'));
  dom.navReceive.addEventListener('click', () => navigate('receive'));
  dom.btnBacks.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.target.getAttribute('data-target');
      navigate(target);
    });
  });

  // === EVENT LISTENERS (HOME) ===
  dom.btnEditName.addEventListener('click', () => {
    dom.inputDeviceName.value = deviceName;
    dom.modeDisplay.classList.add('hidden');
    dom.modeEdit.classList.remove('hidden');
    dom.inputDeviceName.focus();
  });

  dom.btnSaveName.addEventListener('click', saveDeviceName);
  dom.inputDeviceName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveDeviceName();
    if (e.key === 'Escape') {
      dom.modeEdit.classList.add('hidden');
      dom.modeDisplay.classList.remove('hidden');
    }
  });

  dom.btnClearHistory.addEventListener('click', async () => {
    if(confirm('Hapus semua riwayat transfer?')) {
      await clearTransfers();
      await loadHistory();
    }
  });

  // === FUNGSI UTAMA ===

  function navigate(view) {
    window.location.hash = view === 'home' ? '' : view;
  }

  function handleHashChange() {
    const hash = window.location.hash.slice(1);
    const targetView = (hash === 'send' || hash === 'receive') ? hash : 'home';
    
    // Toggle class hidden pada views
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
    
    // Inisialisasi logika spesifik view ketika dibuka
    if (targetView === 'send') initSendView();
    if (targetView === 'receive') initReceiveView();
    if (targetView === 'home') loadHistory(); // Refresh riwayat saat kembali
  }

  function saveDeviceName() {
    const val = dom.inputDeviceName.value.trim().substring(0, 20);
    if (val) {
      deviceName = val;
      localStorage.setItem('nyalur-device-name', val);
      dom.displayDeviceName.textContent = val;
      
      // Update config peerManager jika library Anda mengizinkan perubahan runtime
      // if(window.peerManager) window.peerManager.setDeviceName(val); 
    }
    dom.modeEdit.classList.add('hidden');
    dom.modeDisplay.classList.remove('hidden');
  }

  async function loadHistory() {
    try {
      const history = await getTransfers(20);
      dom.historyList.innerHTML = '';
      dom.historyCount.textContent = `(${history.length})`;

      if (history.length === 0) {
        dom.historyEmpty.classList.remove('hidden');
      } else {
        dom.historyEmpty.classList.add('hidden');
        history.forEach(record => {
          const fileNames = record.files ? record.files.map(f => f.name).join(', ') : 'File';
          const isSent = record.direction === 'sent';
          
          const div = document.createElement('div');
          div.className = 'history-item';
          div.innerHTML = `
            <div style="color: var(--${isSent ? 'green' : 'orange'})">
              ${isSent ? '↑' : '↓'}
            </div>
            <div style="flex:1; min-width:0;">
              <p class="truncate" style="font-size:0.875rem;">${fileNames}</p>
              <p class="text-muted" style="font-size:0.75rem;">
                ${isSent ? '→' : '←'} ${record.peerName || '—'} · ${formatFileSize(record.totalSize)} · ${formatDate(record.timestamp)}
              </p>
            </div>
            <span style="color: var(--${record.status === 'completed' ? 'green' : 'error'})">${record.status === 'completed' ? '✓' : '✗'}</span>
          `;
          dom.historyList.appendChild(div);
        });
      }
    } catch (e) {
      console.error('Failed to load history', e);
    }
  }

  // === PLACEHOLDER LOGIKA SEND & RECEIVE ===
  // Logika DOM untuk menangkap interaksi pengiriman dan penerimaan (yang sebelumnya ada 
  // di dalam tag <script> Send.svelte dan Receive.svelte) bisa ditambahkan dan dipanggil dari sini.
  
  function initSendView() {
    console.log("Send View diakses. Bind logika peerManager untuk Send di sini.");
    // Contoh binding:
    // document.getElementById('input-room-code').addEventListener('input', (e) => {...});
    // document.getElementById('file-input').addEventListener('change', (e) => {...});
  }

  function initReceiveView() {
    console.log("Receive View diakses. Bind logika peerManager untuk Receive di sini.");
    // Contoh eksekusi:
    // peerManager.initAsReceiver().then(res => { 
    //   document.getElementById('display-room-code').textContent = res.roomCode;
    // });
  }

});