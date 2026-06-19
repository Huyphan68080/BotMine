// Quản lý kết nối Socket.io và xử lý giao diện người dùng (UI)

document.addEventListener('DOMContentLoaded', () => {
  // --- Khai báo các phần tử DOM ---
  const backendUrlInput = document.getElementById('backend-url');
  const btnSaveBackend = document.getElementById('btn-save-backend');
  
  const socketPulse = document.getElementById('socket-pulse');
  const socketDot = document.getElementById('socket-dot');
  const socketText = document.getElementById('socket-text');

  const botConfigForm = document.getElementById('bot-config-form');
  const serverIpInput = document.getElementById('server-ip');
  const serverPortInput = document.getElementById('server-port');
  const minecraftVersionSelect = document.getElementById('minecraft-version');
  const botUsernameInput = document.getElementById('bot-username');
  const botPasswordInput = document.getElementById('bot-password');
  const lobbyItemInput = document.getElementById('lobby-item');
  const lobbyServerInput = document.getElementById('lobby-server');
  const lobbyServerPresetSelect = document.getElementById('lobby-server-preset');
  const lobbySwitchMethodSelect = document.getElementById('lobby-switch-method');
  const lobbySwitchCommandInput = document.getElementById('lobby-switch-command');
  const lobbyItemContainer = document.getElementById('lobby-item-container');
  const lobbyServerContainer = document.getElementById('lobby-server-container');
  const lobbySwitchCommandContainer = document.getElementById('lobby-switch-command-container');

  const btnConnectBot = document.getElementById('btn-connect-bot');
  const btnDisconnectBot = document.getElementById('btn-disconnect-bot');



  // TPA DOM elements
  const tpaAutoAcceptCheckbox = document.getElementById('tpa-auto-accept');
  const tpaAutoStatusSpan = document.getElementById('tpa-auto-status');
  const tpaTargetPlayerInput = document.getElementById('tpa-target-player');
  const btnTpa = document.getElementById('btn-tpa');
  const btnTpaHere = document.getElementById('btn-tpa-here');
  const btnTpaAccept = document.getElementById('btn-tpa-accept');
  const btnTpaDeny = document.getElementById('btn-tpa-deny');
  const tpaNotificationContainer = document.getElementById('tpa-notification-container');

  const botPulse = document.getElementById('bot-pulse');
  const botPulseRing = document.getElementById('bot-pulse-ring');
  const botDot = document.getElementById('bot-dot');
  const botStatusText = document.getElementById('bot-status-text');
  const botStatusDesc = document.getElementById('bot-status-desc');

  const statHealthVal = document.getElementById('stat-health-val');
  const statHealthBar = document.getElementById('stat-health-bar');
  const statFoodVal = document.getElementById('stat-food-val');
  const statFoodBar = document.getElementById('stat-food-bar');

  const coordX = document.getElementById('coord-x');
  const coordY = document.getElementById('coord-y');
  const coordZ = document.getElementById('coord-z');

  const chatLog = document.getElementById('chat-log');
  const chatInput = document.getElementById('chat-input');
  const btnSendChat = document.getElementById('btn-send-chat');
  const btnClearChat = document.getElementById('btn-clear-chat');

  // Lịch sử Chat & Kênh Chat Tabs
  const chatHistory = [];
  let activeChatTab = 'all'; // 'all', 'public', 'private', 'system'
  let unreadPrivateCount = 0;

  // Minimap Canvas & Overlay
  const minimapCanvas = document.getElementById('minimap-canvas');
  const minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;
  const minimapOverlay = document.getElementById('minimap-overlay-status');

  // Camera 3D Elements
  const cameraFrame = document.getElementById('camera-frame');
  const cameraOverlay = document.getElementById('camera-overlay');
  const cameraStatusText = document.getElementById('camera-status-text');

  // --- Khởi động đếm giờ chơi (Stopwatch) ---
  let playTimeTimer = null;
  let playTimeSeconds = 0;

  function startPlayTime() {
    stopPlayTime();
    playTimeSeconds = 0;
    updatePlayTimeDisplay();
    playTimeTimer = setInterval(() => {
      playTimeSeconds++;
      updatePlayTimeDisplay();
    }, 1000);
  }

  function stopPlayTime() {
    if (playTimeTimer) {
      clearInterval(playTimeTimer);
      playTimeTimer = null;
    }
  }

  function updatePlayTimeDisplay() {
    const hours = String(Math.floor(playTimeSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((playTimeSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(playTimeSeconds % 60).padStart(2, '0');
    const playTimeLabel = document.getElementById('play-time');
    if (playTimeLabel) {
      playTimeLabel.textContent = `${hours}:${minutes}:${secs}`;
    }
  }

  // --- Khởi tạo Địa chỉ Backend URL ---
  // Hỗ trợ lấy URL từ query parameter (?backend=... hoặc ?api=...) để dễ cấu hình nhanh khi deploy Vercel
  const urlParams = new URLSearchParams(window.location.search);
  const queryBackend = urlParams.get('backend') || urlParams.get('api');
  if (queryBackend) {
    const trimmedUrl = queryBackend.trim();
    if (trimmedUrl) {
      localStorage.setItem('mc_bot_backend_url', trimmedUrl);
      console.log(`[Config] Đã cập nhật Backend URL từ Query Parameter: ${trimmedUrl}`);
      
      // Xóa query parameter trên thanh địa chỉ để URL trông sạch hơn
      try {
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
      } catch (historyErr) {
        console.warn('[Config] Không thể làm sạch query parameters:', historyErr.message);
      }
    }
  }

  // Lấy URL lưu từ localStorage hoặc mặc định là server hiện tại phục vụ trang web
  let savedBackendUrl = localStorage.getItem('mc_bot_backend_url');
  if (!savedBackendUrl) {
    savedBackendUrl = window.location.origin;
  }
  backendUrlInput.value = savedBackendUrl;

  // Tự động tải lại cấu hình Bot đã lưu lần trước từ LocalStorage
  serverIpInput.value = localStorage.getItem('mc_bot_host') || '';
  serverPortInput.value = localStorage.getItem('mc_bot_port') || '25565';
  botUsernameInput.value = localStorage.getItem('mc_bot_username') || '';
  if (botPasswordInput) botPasswordInput.value = localStorage.getItem('mc_bot_password') || '';
  minecraftVersionSelect.value = localStorage.getItem('mc_bot_version') || 'auto';
  if (lobbyItemInput) lobbyItemInput.value = localStorage.getItem('mc_bot_lobby_item') || '';
  


  if (lobbyServerPresetSelect) {
    const savedPreset = localStorage.getItem('mc_bot_lobby_server_preset') || 'auto';
    lobbyServerPresetSelect.value = savedPreset;
    
    // Đồng bộ hiển thị ô nhập tự chọn
    if (savedPreset === 'custom') {
      if (lobbyServerInput) lobbyServerInput.classList.remove('hidden');
    } else {
      if (lobbyServerInput) lobbyServerInput.classList.add('hidden');
    }

    // Lắng nghe thay đổi của dropdown chọn cụm
    lobbyServerPresetSelect.addEventListener('change', (e) => {
      if (e.target.value === 'custom') {
        if (lobbyServerInput) {
          lobbyServerInput.classList.remove('hidden');
          lobbyServerInput.focus();
        }
      } else {
        if (lobbyServerInput) lobbyServerInput.classList.add('hidden');
      }
      localStorage.setItem('mc_bot_lobby_server_preset', e.target.value);
    });
  }

  if (lobbyServerInput) lobbyServerInput.value = localStorage.getItem('mc_bot_lobby_server') || '';

  // Nạp cấu hình cách chuyển cụm (Lobby Switch Method)
  if (lobbySwitchMethodSelect) {
    const savedMethod = localStorage.getItem('mc_bot_lobby_switch_method') || 'menu';
    lobbySwitchMethodSelect.value = savedMethod;
    
    const updateLobbyFields = (method) => {
      if (method === 'command') {
        if (lobbyItemContainer) lobbyItemContainer.classList.add('hidden');
        if (lobbyServerContainer) lobbyServerContainer.classList.add('hidden');
        if (lobbySwitchCommandContainer) lobbySwitchCommandContainer.classList.remove('hidden');
      } else {
        if (lobbyItemContainer) lobbyItemContainer.classList.remove('hidden');
        if (lobbyServerContainer) lobbyServerContainer.classList.remove('hidden');
        if (lobbySwitchCommandContainer) lobbySwitchCommandContainer.classList.add('hidden');
      }
    };
    
    updateLobbyFields(savedMethod);
    
    lobbySwitchMethodSelect.addEventListener('change', (e) => {
      updateLobbyFields(e.target.value);
      localStorage.setItem('mc_bot_lobby_switch_method', e.target.value);
    });
  }
  
  if (lobbySwitchCommandInput) {
    lobbySwitchCommandInput.value = localStorage.getItem('mc_bot_lobby_switch_command') || '/server chill';
    lobbySwitchCommandInput.addEventListener('input', (e) => {
      localStorage.setItem('mc_bot_lobby_switch_command', e.target.value);
    });
  }
  
  const authTypeSelect = document.getElementById('auth-type');
  const autoReconnectCheckbox = document.getElementById('auto-reconnect');
  if (authTypeSelect) authTypeSelect.value = localStorage.getItem('mc_bot_auth') || 'offline';
  if (autoReconnectCheckbox) {
    const savedAutoRec = localStorage.getItem('mc_bot_auto_reconnect');
    autoReconnectCheckbox.checked = savedAutoRec !== 'false'; // Mặc định là true nếu chưa lưu
  }

  // Sự kiện lưu cấu hình URL Backend
  btnSaveBackend.addEventListener('click', () => {
    const newUrl = backendUrlInput.value.trim();
    if (newUrl) {
      localStorage.setItem('mc_bot_backend_url', newUrl);
      alert('Đã lưu địa chỉ Backend URL! Trang web sẽ được tải lại để kết nối mới.');
      window.location.reload();
    }
  });

  // --- Khởi tạo Kết nối Socket.io với Backend ---
  console.log(`[Socket] Đang cố kết nối đến Backend: ${savedBackendUrl}`);
  let socket;
  try {
    socket = io(savedBackendUrl, {
      reconnectionAttempts: 5,
      timeout: 10000,
      autoConnect: true
    });
  } catch (err) {
    console.error('[Socket] Lỗi khởi tạo socket.io-client:', err);
    updateBackendConnectionStatus('disconnected', `Lỗi khởi tạo: ${err.message}`);
  }

  // --- Quản lý Trạng thái Kết nối Socket (Backend) ---
  if (socket) {
    socket.on('connect', () => {
      console.log(`[Socket] Đã kết nối thành công tới Backend. ID: ${socket.id}`);
      updateBackendConnectionStatus('connected', 'Backend: Đã kết nối');
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Mất kết nối tới Backend. Lý do:', reason);
      updateBackendConnectionStatus('disconnected', 'Backend: Mất kết nối');
      updateBotStatus('offline', 'Mất kết nối tới backend app');
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Lỗi kết nối tới Backend:', error);
      updateBackendConnectionStatus('disconnected', 'Backend: Lỗi kết nối');
    });
  }

  function updateBackendConnectionStatus(status, message) {
    socketText.textContent = message;
    if (status === 'connected') {
      socketDot.className = 'relative inline-flex rounded-full h-1.5 w-1.5 bg-purpleAccent';
      socketPulse.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-purpleGlow opacity-75';
    } else {
      socketDot.className = 'relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500';
      socketPulse.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75';
    }
  }

  // --- Quản lý trạng thái Bot Minecraft (UI) ---
  let isBotOnline = false;

  function updateBotStatus(status, message) {
    botStatusDesc.textContent = message;
    
    switch (status) {
      case 'online':
        isBotOnline = true;
        botStatusText.textContent = 'ONLINE';
        botStatusText.className = 'text-xs font-bold text-purpleAccent drop-shadow-[0_0_8px_rgba(121,70,240,0.4)] tracking-wider';
        botPulseRing.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-purpleGlow opacity-75';
        botDot.className = 'relative inline-flex rounded-full h-2.5 w-2.5 bg-purpleAccent';
        
        // Bắt đầu tính giờ chơi
        startPlayTime();

        // Điều khiển nút & form
        btnConnectBot.disabled = true;
        btnConnectBot.className = 'bg-zinc-900 text-zinc-600 border border-zinc-850 cursor-not-allowed font-bold uppercase tracking-widest text-[11px] px-5 py-2.5 rounded-lg flex items-center gap-1.5 shadow-none';
        btnDisconnectBot.disabled = false;
        btnDisconnectBot.className = 'bg-red-600 hover:bg-red-500 text-white font-bold uppercase tracking-widest text-[11px] px-5 py-2.5 rounded-lg transition active:scale-95 flex items-center gap-1.5 shadow-[0_0_15px_rgba(220,38,38,0.3)]';
        
        // Bật chat input
        chatInput.disabled = false;
        chatInput.placeholder = 'Nhập tin nhắn / lệnh gửi tới server...';
        btnSendChat.disabled = false;
        btnSendChat.className = 'bg-purpleAccent hover:bg-purpleGlow text-white font-bold uppercase tracking-widest text-[9px] px-3.5 py-1.5 rounded transition active:scale-95 flex items-center justify-center shadow-[0_0_12px_rgba(121,70,240,0.3)]';
        break;

      case 'connecting':
        isBotOnline = false;
        botStatusText.textContent = 'CONNECTING';
        botStatusText.className = 'text-xs font-bold text-yellow-500 tracking-wider';
        botPulseRing.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75';
        botDot.className = 'relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-550';

        if (cameraStatusText) {
          cameraStatusText.textContent = 'Đang khởi chạy camera 3D...';
        }

        // Điều khiển nút & form
        btnConnectBot.disabled = true;
        btnConnectBot.className = 'bg-zinc-900 text-zinc-600 border border-zinc-850 cursor-not-allowed font-bold uppercase tracking-widest text-[11px] px-5 py-2.5 rounded-lg flex items-center gap-1.5 shadow-none';
        btnDisconnectBot.disabled = false; // Vẫn cho phép ngắt kết nối khi đang cố gắng kết nối
        btnDisconnectBot.className = 'bg-red-600 hover:bg-red-500 text-white font-bold uppercase tracking-widest text-[11px] px-5 py-2.5 rounded-lg transition active:scale-95 flex items-center gap-1.5';
        
        // Tắt chat input
        chatInput.disabled = true;
        chatInput.placeholder = 'Đang kết nối bot tới server...';
        btnSendChat.disabled = true;
        btnSendChat.className = 'bg-zinc-900 text-zinc-650 border border-zinc-850 font-bold uppercase tracking-widest text-[9px] px-3.5 py-1.5 rounded cursor-not-allowed flex items-center justify-center';
        break;

      case 'error':
      case 'offline':
      default:
        isBotOnline = false;
        botStatusText.textContent = status === 'error' ? 'ERROR' : 'OFFLINE';
        botStatusText.className = status === 'error' ? 'text-xs font-bold text-red-500 tracking-wider' : 'text-xs font-bold text-zinc-500 tracking-wider';
        botPulseRing.className = status === 'error' ? 'animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75' : 'animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-650 opacity-75';
        botDot.className = status === 'error' ? 'relative inline-flex rounded-full h-2.5 w-2.5 bg-red-550' : 'relative inline-flex rounded-full h-2.5 w-2.5 bg-zinc-650';

        // Dừng đếm giờ chơi
        stopPlayTime();

        // Reset các thông số stats về 0
        resetStats();

        // Tắt tất cả toggle module hack khi ngắt kết nối
        const killauraToggle = document.getElementById('killaura-toggle');
        const autoeatToggle = document.getElementById('autoeat-toggle');
        const autoarmorToggle = document.getElementById('autoarmor-toggle');
        const aisurvivalToggle = document.getElementById('aisurvival-toggle');
        if (killauraToggle) killauraToggle.checked = false;
        if (autoeatToggle) autoeatToggle.checked = false;
        if (autoarmorToggle) autoarmorToggle.checked = false;
        if (aisurvivalToggle) aisurvivalToggle.checked = false;

        // Điều khiển nút & form
        btnConnectBot.disabled = false;
        btnConnectBot.className = 'bg-purpleAccent hover:bg-purpleGlow text-white font-bold uppercase tracking-widest text-[11px] px-5 py-2.5 rounded-lg transition active:scale-95 flex items-center gap-1.5 shadow-[0_0_15px_rgba(121,70,240,0.3)]';
        btnDisconnectBot.disabled = true;
        btnDisconnectBot.className = 'bg-zinc-900 text-zinc-600 border border-zinc-850 font-bold uppercase tracking-widest text-[11px] px-5 py-2.5 rounded-lg cursor-not-allowed flex items-center gap-1.5';
        
        // Tắt chat input
        chatInput.disabled = true;
        chatInput.placeholder = 'Chờ kết nối bot...';
        btnSendChat.disabled = true;
        btnSendChat.className = 'bg-zinc-900 text-zinc-650 border border-zinc-850 font-bold uppercase tracking-widest text-[9px] px-3.5 py-1.5 rounded cursor-not-allowed flex items-center justify-center';
        break;
    }
  }

  function resetStats() {
    statHealthVal.textContent = '0/20';
    statHealthBar.style.width = '0%';
    statFoodVal.textContent = '0/20';
    statFoodBar.style.width = '0%';
    coordX.textContent = '0.00';
    coordY.textContent = '0.00';
    coordZ.textContent = '0.00';
  }

  // --- Sự kiện click của các nút bấm kết nối bot ---

  // Gửi sự kiện yêu cầu kết nối bot
  btnConnectBot.addEventListener('click', () => {
    if (!socket || !socket.connected) {
      alert('Chưa thể kết nối tới Backend! Vui lòng kiểm tra lại URL Backend hoặc đảm bảo Backend đang chạy.');
      return;
    }

    const host = serverIpInput.value.trim();
    const port = serverPortInput.value.trim();
    const username = botUsernameInput.value.trim();
    const password = botPasswordInput ? botPasswordInput.value.trim() : '';
    const version = minecraftVersionSelect.value;
    
    const auth = authTypeSelect ? authTypeSelect.value : 'offline';
    const autoReconnect = autoReconnectCheckbox ? autoReconnectCheckbox.checked : true;
    const lobbyItem = lobbyItemInput ? lobbyItemInput.value.trim() : '';
    
    const preset = lobbyServerPresetSelect ? lobbyServerPresetSelect.value : 'auto';
    let lobbyServer = '';
    if (preset === 'custom') {
      lobbyServer = lobbyServerInput ? lobbyServerInput.value.trim() : '';
    } else if (preset !== 'auto') {
      lobbyServer = preset;
    }

    const lobbySwitchMethod = lobbySwitchMethodSelect ? lobbySwitchMethodSelect.value : 'menu';
    const lobbySwitchCommand = lobbySwitchCommandInput ? lobbySwitchCommandInput.value.trim() : '';

    if (!host || !username) {
      alert('Vui lòng điền đầy đủ IP Server và Tên Bot!');
      return;
    }

    // Lưu cấu hình bot vào localStorage để tự động nạp lại khi tải lại trang
    localStorage.setItem('mc_bot_host', host);
    localStorage.setItem('mc_bot_port', port);
    localStorage.setItem('mc_bot_username', username);
    localStorage.setItem('mc_bot_password', password);
    localStorage.setItem('mc_bot_version', version);
    localStorage.setItem('mc_bot_auth', auth);
    localStorage.setItem('mc_bot_auto_reconnect', autoReconnect);
    localStorage.setItem('mc_bot_lobby_item', lobbyItem);
    localStorage.setItem('mc_bot_lobby_server', lobbyServer);
    localStorage.setItem('mc_bot_lobby_server_preset', preset);
    localStorage.setItem('mc_bot_lobby_switch_method', lobbySwitchMethod);
    localStorage.setItem('mc_bot_lobby_switch_command', lobbySwitchCommand);

    const autoAcceptTpa = tpaAutoAcceptCheckbox ? tpaAutoAcceptCheckbox.checked : false;

    // Gửi sự kiện `start-bot` kèm đầy đủ cấu hình nâng cao bao gồm cả loại quặng muốn đào
    const miningTargetSelect = document.getElementById('mining-target-ore');
    const miningTarget = miningTargetSelect ? miningTargetSelect.value : 'all';
    socket.emit('start-bot', { 
      host, port, username, password, version, auth, autoReconnect, 
      lobbyItem, lobbyServer, miningTarget,
      autoAcceptTpa,
      lobbySwitchMethod, lobbySwitchCommand
    });
    appendChatLog('System', `Yêu cầu kết nối bot [${username}] tới ${host}:${port || '25565'} (Auth: ${auth})...`, 'system');

  });


  // Gửi sự kiện yêu cầu ngắt kết nối bot
  btnDisconnectBot.addEventListener('click', () => {
    if (!socket || !socket.connected) return;
    
    socket.emit('stop-bot');
    appendChatLog('System', 'Yêu cầu dừng kết nối bot...', 'system');
  });

  // --- Gửi tin nhắn chat từ client ---
  function sendChatMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    if (!socket || !socket.connected || !isBotOnline) {
      alert('Bot chưa sẵn sàng hoặc mất kết nối backend!');
      return;
    }

    socket.emit('send-chat', message);
    chatInput.value = ''; // Xóa sạch ô nhập
    chatInput.focus();
  }

  btnSendChat.addEventListener('click', sendChatMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendChatMessage();
    }
  });

  // Xóa màn hình nhật ký chat
  btnClearChat.addEventListener('click', () => {
    chatHistory.length = 0; // Xóa sạch lịch sử lưu trữ
    chatLog.innerHTML = '<div class="text-zinc-600 italic text-[11px]">Màn hình chat đã được xóa sạch.</div>';
  });

  // --- Thiết lập chọn các Kênh Chat Tabs ---
  const tabChatAll = document.getElementById('tab-chat-all');
  const tabChatPublic = document.getElementById('tab-chat-public');
  const tabChatPrivate = document.getElementById('tab-chat-private');
  const tabChatSystem = document.getElementById('tab-chat-system');
  const privateBadge = document.getElementById('private-badge');

  const chatTabs = [
    { el: tabChatAll, id: 'all' },
    { el: tabChatPublic, id: 'public' },
    { el: tabChatPrivate, id: 'private' },
    { el: tabChatSystem, id: 'system' }
  ];

  chatTabs.forEach(tab => {
    if (tab.el) {
      tab.el.addEventListener('click', () => {
        activeChatTab = tab.id;
        
        chatTabs.forEach(t => {
          if (t.el) {
            if (t.id === tab.id) {
              t.el.classList.add('active', 'text-purpleAccent', 'border-b', 'border-purpleAccent');
              t.el.classList.remove('text-zinc-550', 'hover:text-zinc-350');
            } else {
              t.el.classList.remove('active', 'text-purpleAccent', 'border-b', 'border-purpleAccent');
              t.el.classList.add('text-zinc-550', 'hover:text-zinc-350');
            }
          }
        });

        // Nếu chuyển sang tab nhắn riêng, xóa badge đếm tin nhắn chưa đọc
        if (tab.id === 'private') {
          unreadPrivateCount = 0;
          if (privateBadge) {
            privateBadge.classList.add('hidden');
            privateBadge.textContent = '0';
          }
        }

        renderChatLog();
      });
    }
  });

  function renderChatLog() {
    if (!chatLog) return;
    chatLog.innerHTML = '';

    if (chatHistory.length === 0) {
      chatLog.innerHTML = '<div class="text-zinc-650 italic text-[11px]">Không có tin nhắn nào.</div>';
      return;
    }

    const filtered = chatHistory.filter(msg => {
      if (activeChatTab === 'all') return true;
      if (activeChatTab === 'public') return msg.type === 'public' || msg.type === 'other' || msg.type === 'bot';
      if (activeChatTab === 'private') return msg.type === 'private';
      if (activeChatTab === 'system') return msg.type === 'system';
      return false;
    });

    if (filtered.length === 0) {
      chatLog.innerHTML = '<div class="text-zinc-650 italic text-[11px]">Không có tin nhắn phù hợp trong kênh này.</div>';
      return;
    }

    filtered.forEach(msg => {
      appendDivToChatLog(msg.sender, msg.message, msg.type, msg.time, msg.prefix, msg.receiver);
    });
  }

  // --- Lắng nghe các sự kiện socket từ Backend ---
  if (socket) {
    // 1. Nhận cập nhật trạng thái bot
    socket.on('bot-status', (data) => {
      console.log('[Socket] Nhận trạng thái bot:', data);
      updateBotStatus(data.status, data.message);
    });

    // 2. Nhận thông số sinh tồn và tọa độ realtime
    socket.on('bot-info', (data) => {
      // Cập nhật Máu
      if (data.health !== undefined) {
        const hp = data.health;
        statHealthVal.textContent = `${hp}/20`;
        // Tính phần trăm máu (máu Minecraft tối đa mặc định là 20)
        const percent = Math.min((hp / 20) * 100, 100);
        statHealthBar.style.width = `${percent}%`;
        
        // Thêm màu sắc động tùy thuộc mức độ máu
        if (percent > 50) {
          statHealthBar.className = 'bg-rose-500 h-full rounded-full transition-all duration-350';
        } else if (percent > 20) {
          statHealthBar.className = 'bg-yellow-500 h-full rounded-full transition-all duration-350';
        } else {
          statHealthBar.className = 'bg-red-650 h-full rounded-full transition-all duration-350 animate-pulse';
        }
      }

      // Cập nhật Thức ăn
      if (data.food !== undefined) {
        const food = data.food;
        statFoodVal.textContent = `${food}/20`;
        const percent = Math.min((food / 20) * 100, 100);
        statFoodBar.style.width = `${percent}%`;
      }

      // Cập nhật Tọa độ X Y Z
      if (data.coords) {
        coordX.textContent = Number(data.coords.x).toFixed(2);
        coordY.textContent = Number(data.coords.y).toFixed(2);
        coordZ.textContent = Number(data.coords.z).toFixed(2);
      }
    });

    // 3. Nhận tin nhắn chat từ game
    socket.on('bot-chat', (data) => {
      const { sender, prefix, message, receiver, time, type } = data;
      
      let chatType = type || 'other'; // 'public', 'private', 'system', 'other'
      if (!type) {
        if (sender === 'System') {
          chatType = 'system';
        } else if (sender === botUsernameInput.value.trim() || sender === botStatusDesc.textContent.replace('Đã kết nối thành công với tên: ', '')) {
          chatType = 'bot';
        }
      }
      
      appendChatLog(sender, message, chatType, time);
    });

    // 4. Nhận ảnh bản đồ captcha
    socket.on('bot-map', (data) => {
      console.log('[Socket] Nhận ảnh bản đồ Captcha, ID:', data.id);
      const captchaContainer = document.getElementById('captcha-container');
      const captchaImg = document.getElementById('captcha-img');
      if (captchaContainer && captchaImg && data.image) {
        captchaImg.src = data.image;
        captchaContainer.classList.remove('hidden');
        appendChatLog('System', 'Phát hiện mã xác thực Captcha bằng hình ảnh trên bản đồ! Hãy xem ảnh hiển thị và nhập mã vào ô chat.', 'system');
      }
    });

    // 5. Ẩn captcha, hiển thị lớp phủ radar, và reset camera khi bot ngắt kết nối
    socket.on('bot-status', (data) => {
      if (data.status === 'offline' || data.status === 'error') {
        const captchaContainer = document.getElementById('captcha-container');
        if (captchaContainer) captchaContainer.classList.add('hidden');
        
        if (minimapOverlay) {
          minimapOverlay.classList.remove('hidden');
          const spanText = minimapOverlay.querySelector('span');
          if (spanText) {
            spanText.textContent = data.status === 'error' ? 'Lỗi kết nối bot!' : 'Chờ bot kết nối trực tiếp...';
          }
        }

        // Reset camera 3D khi bot offline/error
        if (cameraFrame) {
          cameraFrame.src = '';
          cameraFrame.classList.add('hidden');
        }
        if (cameraOverlay) {
          cameraOverlay.classList.remove('hidden');
        }
        if (cameraStatusText) {
          cameraStatusText.textContent = data.status === 'error' ? 'Lỗi kết nối bot!' : 'Chờ bot kết nối để mở camera 3D...';
        }
      }
    });

    // 6.5. Nhận URL camera 3D từ backend (prismarine-viewer qua localtunnel)
    socket.on('camera_url', (url) => {
      console.log('[Socket] Nhận camera_url:', url);
      if (url && typeof url === 'string' && url.startsWith('http')) {
        // Có URL hợp lệ -> hiển thị iframe, ẩn overlay
        if (cameraFrame) {
          const separator = url.includes('?') ? '&' : '?';
          const freshUrl = `${url}${separator}t=${Date.now()}`;
          cameraFrame.src = freshUrl;
          cameraFrame.classList.remove('hidden');
        }
        if (cameraOverlay) {
          cameraOverlay.classList.add('hidden');
        }
        appendChatLog('System', `Camera 3D đã sẵn sàng: ${url}`, 'system');
      } else {
        // URL trống hoặc không hợp lệ -> reset camera
        if (cameraFrame) {
          cameraFrame.src = '';
          cameraFrame.classList.add('hidden');
        }
        if (cameraOverlay) {
          cameraOverlay.classList.remove('hidden');
        }
        if (cameraStatusText) {
          cameraStatusText.textContent = 'Không thể mở camera 3D (Lỗi tunnel)';
        }
      }
    });

    // 6. Nhận dữ liệu radar quét thời gian thực
    socket.on('bot-radar', (data) => {
      if (!minimapCanvas || !minimapCtx) return;
      
      // Ẩn lớp phủ trạng thái
      if (minimapOverlay) {
        minimapOverlay.classList.add('hidden');
      }
      
      const { yaw, blocks, entities, range = 8, oreCounts } = data;
      const width = minimapCanvas.width;
      const height = minimapCanvas.height;
      
      // Xóa canvas
      minimapCtx.fillStyle = '#020617'; // slate-950
      minimapCtx.fillRect(0, 0, width, height);
      
      // Lưới block có kích thước động dựa trên range
      const gridSize = range * 2 + 1;
      const tileSize = width / gridSize;
      
      // Màu sắc tương ứng với blockType
      const colors = {
        0: '#020617', // Air/Void: Slate-950
        1: '#166534', // Grass/Leaves: Green-800
        2: '#334155', // Stone/Clay: Slate-700
        3: '#1e40af', // Water: Blue-800
        4: '#991b1b', // Lava: Red-800
        5: '#78350f', // Wood: Amber-900
        6: '#475569', // Other solid: Slate-600
        10: '#475569', // Coal Ore
        11: '#d97706', // Iron Ore
        12: '#ea580c', // Copper Ore
        13: '#eab308', // Gold Ore
        14: '#ef4444', // Redstone Ore
        15: '#2563eb', // Lapis Ore
        16: '#06b6d4', // Diamond Ore
        17: '#10b981', // Emerald Ore
        18: '#f1f5f9', // Quartz Ore
        19: '#7c2d12'  // Ancient Debris
      };
      
      // Lấy loại quặng mục tiêu đang được chọn
      const miningTargetSelect = document.getElementById('mining-target-ore');
      const currentTarget = miningTargetSelect ? miningTargetSelect.value : 'all';
      const targetMap = {
        'coal_ore': 10,
        'iron_ore': 11,
        'copper_ore': 12,
        'gold_ore': 13,
        'redstone_ore': 14,
        'lapis_ore': 15,
        'diamond_ore': 16,
        'emerald_ore': 17,
        'quartz_ore': 18,
        'ancient_debris': 19
      };
      const targetBlockType = targetMap[currentTarget];
      
      // Vẽ blocks
      if (blocks && blocks.length === gridSize * gridSize) {
        for (let r = 0; r < gridSize; r++) {
          for (let c = 0; c < gridSize; c++) {
            const blockType = blocks[r * gridSize + c];
            
            if (blockType === targetBlockType && targetBlockType !== undefined) {
              // Hiệu ứng nhấp nháy phát sáng cho quặng mục tiêu
              const pulse = Math.abs(Math.sin(Date.now() / 200));
              minimapCtx.fillStyle = colors[blockType];
              minimapCtx.fillRect(c * tileSize, r * tileSize, tileSize - 0.5, tileSize - 0.5);
              
              minimapCtx.strokeStyle = `rgba(255, 255, 255, ${0.4 + 0.6 * pulse})`;
              minimapCtx.lineWidth = 1.5;
              minimapCtx.strokeRect(c * tileSize + 0.5, r * tileSize + 0.5, tileSize - 1.5, tileSize - 1.5);
            } else {
              minimapCtx.fillStyle = colors[blockType] || colors[0];
              minimapCtx.fillRect(c * tileSize, r * tileSize, tileSize - 0.5, tileSize - 0.5);
            }
          }
        }
      }
      
      // Vẽ các vòng tròn radar đồng tâm cho đẹp mắt và định hướng
      minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      minimapCtx.lineWidth = 1;
      
      const centerX = width / 2;
      const centerY = height / 2;
      const circleRadii = [width / 4, width / 2 - 5];
      if (range === 16) {
        circleRadii.push(width * 0.125);
        circleRadii.push(width * 0.375);
      }
      circleRadii.forEach(radius => {
        minimapCtx.beginPath();
        minimapCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        minimapCtx.stroke();
      });
      
      // Cập nhật số lượng quặng thực tế xung quanh bot trên giao diện
      if (oreCounts) {
        const oreTypes = ['coal_ore', 'iron_ore', 'copper_ore', 'gold_ore', 'redstone_ore', 'lapis_ore', 'diamond_ore', 'emerald_ore', 'quartz_ore', 'ancient_debris'];
        
        oreTypes.forEach(t => {
          const countSpan = document.getElementById(`count-${t}`);
          const cardDiv = document.getElementById(`ore-card-${t}`);
          
          if (countSpan) {
            const count = oreCounts[t] || 0;
            countSpan.textContent = count;
            if (count > 0) {
              countSpan.className = 'font-bold text-purpleAccent scale-105 transition duration-300';
            } else {
              countSpan.className = 'font-bold text-zinc-500';
            }
          }
          
          if (cardDiv) {
            // Highlight card nếu là quặng đang được chọn làm mục tiêu đào
            if (t === currentTarget) {
              cardDiv.className = 'flex items-center justify-between bg-purpleAccent/10 px-2.5 py-1.5 rounded border border-purpleAccent/45 shadow-inner shadow-purpleAccent/5 transition duration-300 scale-[1.02]';
            } else {
              cardDiv.className = 'flex items-center justify-between bg-zinc-900/40 px-2.5 py-1.5 rounded border border-zinc-850 transition duration-300';
            }
          }
        });
      }
      
      // Vẽ các thực thể (Entities)
      const maxRange = range + 0.5; // Kích thước bán kính lưới block
      
      if (entities && Array.isArray(entities)) {
        entities.forEach(entity => {
          const { relX, relZ, name, category } = entity;
          const entityName = name || 'Entity';
          
          const canvasX = centerX + (relX / maxRange) * (width / 2);
          const canvasY = centerY + (relZ / maxRange) * (height / 2);
          
          if (canvasX >= 0 && canvasX <= width && canvasY >= 0 && canvasY <= height) {
            let color = '#94a3b8'; // Mặc định: xám (other)
            if (category === 'player') {
              color = '#22c55e'; // Player: Xanh lá sáng
            } else if (category === 'hostile') {
              color = '#f43f5e'; // Hostile: Hồng đỏ rực
            } else if (category === 'passive') {
              color = '#fbbf24'; // Passive: Vàng sáng
            }
            
            // Vẽ chấm thực thể
            minimapCtx.fillStyle = color;
            minimapCtx.beginPath();
            minimapCtx.arc(canvasX, canvasY, 4, 0, 2 * Math.PI);
            minimapCtx.fill();
            
            // Viết nhãn tên thực thể nhỏ phía trên chấm tròn nếu ở gần bot
            const dist = Math.sqrt(relX * relX + relZ * relZ);
            if (dist < (range * 0.75)) {
               minimapCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
               minimapCtx.font = '8px sans-serif';
               minimapCtx.textBaseline = 'bottom';
               minimapCtx.textAlign = 'center';
               const shortName = entityName.length > 8 ? entityName.substring(0, 7) + '..' : entityName;
               minimapCtx.fillText(shortName, canvasX, canvasY - 6);
            }
          }
        });
      }
      
      // Vẽ Bot ở trung tâm (màu Tím sáng rực để hợp tone Salarixi)
      minimapCtx.fillStyle = '#7946f0'; // PurpleAccent
      minimapCtx.strokeStyle = '#a855f7'; // Purple-500
      minimapCtx.lineWidth = 2;
      minimapCtx.beginPath();
      minimapCtx.arc(centerX, centerY, 5, 0, 2 * Math.PI);
      minimapCtx.fill();
      minimapCtx.stroke();
      
      // Vẽ hướng nhìn của Bot (tam giác/mũi tên hướng theo yaw)
      if (yaw !== undefined) {
        const angle = -yaw - Math.PI; // Hướng nhìn trên canvas
        const dirX = Math.sin(angle);
        const dirY = Math.cos(angle);
        
        minimapCtx.fillStyle = '#a855f7';
        minimapCtx.beginPath();
        minimapCtx.moveTo(centerX + dirX * 12, centerY + dirY * 12);
        minimapCtx.lineTo(centerX + Math.sin(angle - 2.5) * 6, centerY + Math.cos(angle - 2.5) * 6);
        minimapCtx.lineTo(centerX + Math.sin(angle + 2.5) * 6, centerY + Math.cos(angle + 2.5) * 6);
        minimapCtx.closePath();
        minimapCtx.fill();
      }
    });

    // Nhận cập nhật trạng thái bật/tắt module từ backend
    socket.on('module_state_change', (data) => {
      const { module, state } = data;
      console.log(`[Socket] Cập nhật module: ${module} -> ${state}`);
      if (module === 'killaura') {
        const toggle = document.getElementById('killaura-toggle');
        if (toggle) toggle.checked = state;
      } else if (module === 'autoeat') {
        const toggle = document.getElementById('autoeat-toggle');
        if (toggle) toggle.checked = state;
      } else if (module === 'autoarmor') {
        const toggle = document.getElementById('autoarmor-toggle');
        if (toggle) toggle.checked = state;
      } else if (module === 'ai_survival') {
        const toggle = document.getElementById('aisurvival-toggle');
        if (toggle) toggle.checked = state;
      }
    });
  }

  // --- Lắng nghe các Module Hack phong cách Hack Client ---
  const killauraToggle = document.getElementById('killaura-toggle');
  const autoeatToggle = document.getElementById('autoeat-toggle');
  const autoarmorToggle = document.getElementById('autoarmor-toggle');
  const autoReconnectToggle = document.getElementById('auto-reconnect-toggle');
  const killauraDualwieldToggle = document.getElementById('killaura-dualwield-toggle');
  const aisurvivalToggle = document.getElementById('aisurvival-toggle');

  if (killauraDualwieldToggle) {
    // Khôi phục trạng thái từ localStorage
    const savedDualwield = localStorage.getItem('mc_bot_killaura_dualwield');
    killauraDualwieldToggle.checked = savedDualwield !== 'false'; // Mặc định là true

    killauraDualwieldToggle.addEventListener('change', (e) => {
      localStorage.setItem('mc_bot_killaura_dualwield', e.target.checked);
      if (socket && socket.connected && isBotOnline) {
        socket.emit('toggle_module', { module: 'killaura_dualwield', state: e.target.checked });
      }
    });
  }

  if (killauraToggle) {
    killauraToggle.addEventListener('change', (e) => {
      if (!socket || !socket.connected || !isBotOnline) {
        alert('Bot chưa kết nối! Vui lòng kết nối Bot trước khi bật Killaura.');
        e.target.checked = false;
        return;
      }
      const dualwieldState = killauraDualwieldToggle ? killauraDualwieldToggle.checked : true;
      socket.emit('toggle_module', { 
        module: 'killaura', 
        state: e.target.checked,
        dualwield: dualwieldState
      });
    });
  }

  if (autoeatToggle) {
    autoeatToggle.addEventListener('change', (e) => {
      if (!socket || !socket.connected || !isBotOnline) {
        alert('Bot chưa kết nối! Vui lòng kết nối Bot trước khi bật Auto-Eat.');
        e.target.checked = false;
        return;
      }
      socket.emit('toggle_module', { module: 'autoeat', state: e.target.checked });
    });
  }

  if (autoarmorToggle) {
    autoarmorToggle.addEventListener('change', (e) => {
      if (!socket || !socket.connected || !isBotOnline) {
        alert('Bot chưa kết nối! Vui lòng kết nối Bot trước khi bật Auto-Armor.');
        e.target.checked = false;
        return;
      }
      socket.emit('toggle_module', { module: 'autoarmor', state: e.target.checked });
    });
  }

  if (aisurvivalToggle) {
    aisurvivalToggle.addEventListener('change', (e) => {
      if (!socket || !socket.connected || !isBotOnline) {
        alert('Bot chưa kết nối! Vui lòng kết nối Bot trước khi bật AI Sinh tồn.');
        e.target.checked = false;
        return;
      }
      socket.emit('toggle_module', { module: 'ai_survival', state: e.target.checked });
    });
  }

  const miningTargetSelect = document.getElementById('mining-target-ore');
  if (miningTargetSelect) {
    // Khôi phục cấu hình từ localStorage
    const savedMiningTarget = localStorage.getItem('mc_bot_mining_target') || 'all';
    miningTargetSelect.value = savedMiningTarget;

    const updateMiningTarget = () => {
      const val = miningTargetSelect.value;
      localStorage.setItem('mc_bot_mining_target', val);
      if (socket && socket.connected && isBotOnline) {
        socket.emit('set_survival_config', { key: 'mining_target', value: val });
      }
    };

    miningTargetSelect.addEventListener('change', updateMiningTarget);
  }

  // --- TPA Event Listeners ---
  if (tpaAutoAcceptCheckbox) {
    // Khôi phục cài đặt từ localStorage
    const savedTpaAuto = localStorage.getItem('mc_bot_tpa_auto') === 'true';
    tpaAutoAcceptCheckbox.checked = savedTpaAuto;
    if (tpaAutoStatusSpan) {
      if (savedTpaAuto) {
        tpaAutoStatusSpan.textContent = 'BẬT';
        tpaAutoStatusSpan.className = 'text-green-400 font-bold font-mono';
      } else {
        tpaAutoStatusSpan.textContent = 'TẮT';
        tpaAutoStatusSpan.className = 'text-zinc-500 font-bold font-mono';
      }
    }

    tpaAutoAcceptCheckbox.addEventListener('change', (e) => {
      const state = e.target.checked;
      localStorage.setItem('mc_bot_tpa_auto', state);
      if (tpaAutoStatusSpan) {
        if (state) {
          tpaAutoStatusSpan.textContent = 'BẬT';
          tpaAutoStatusSpan.className = 'text-green-400 font-bold font-mono';
        } else {
          tpaAutoStatusSpan.textContent = 'TẮT';
          tpaAutoStatusSpan.className = 'text-zinc-500 font-bold font-mono';
        }
      }
      if (socket && socket.connected) {
        socket.emit('toggle_tpa_auto', state);
      }
    });
  }

  if (btnTpa) {
    btnTpa.addEventListener('click', () => {
      const player = tpaTargetPlayerInput.value.trim();
      if (!player) {
        alert('Vui lòng nhập tên người chơi mục tiêu!');
        return;
      }
      if (socket && socket.connected && isBotOnline) {
        socket.emit('tpa-send', player);
        appendChatLog('System', `Đã gửi yêu cầu dịch chuyển tới: ${player}`, 'system');
      } else {
        alert('Bot chưa kết nối!');
      }
    });
  }

  if (btnTpaHere) {
    btnTpaHere.addEventListener('click', () => {
      const player = tpaTargetPlayerInput.value.trim();
      if (!player) {
        alert('Vui lòng nhập tên người chơi mục tiêu!');
        return;
      }
      if (socket && socket.connected && isBotOnline) {
        socket.emit('tpa-here-send', player);
        appendChatLog('System', `Đã gửi yêu cầu kéo người chơi ${player} tới vị trí bot`, 'system');
      } else {
        alert('Bot chưa kết nối!');
      }
    });
  }

  if (btnTpaAccept) {
    btnTpaAccept.addEventListener('click', () => {
      if (socket && socket.connected && isBotOnline) {
        socket.emit('tpa-action', { action: 'accept' });
        appendChatLog('System', 'Đã gửi lệnh đồng ý tất cả yêu cầu dịch chuyển.', 'system');
      } else {
        alert('Bot chưa kết nối!');
      }
    });
  }

  if (btnTpaDeny) {
    btnTpaDeny.addEventListener('click', () => {
      if (socket && socket.connected && isBotOnline) {
        socket.emit('tpa-action', { action: 'deny' });
        appendChatLog('System', 'Đã gửi lệnh từ chối tất cả yêu cầu dịch chuyển.', 'system');
      } else {
        alert('Bot chưa kết nối!');
      }
    });
  }

  if (autoReconnectToggle) {
    autoReconnectToggle.addEventListener('change', (e) => {
      if (autoReconnectCheckbox) {
        autoReconnectCheckbox.checked = e.target.checked;
      }
      localStorage.setItem('mc_bot_auto_reconnect', e.target.checked);
    });
    // Khôi phục giá trị đã lưu từ localStorage
    const savedAutoRec = localStorage.getItem('mc_bot_auto_reconnect');
    if (savedAutoRec !== null) {
      autoReconnectToggle.checked = savedAutoRec !== 'false';
      if (autoReconnectCheckbox) {
        autoReconnectCheckbox.checked = savedAutoRec !== 'false';
      }
    }
  }

  // Đồng bộ chiều ngược lại từ checkbox cấu hình sang switch toggle nhanh
  if (autoReconnectCheckbox) {
    autoReconnectCheckbox.addEventListener('change', (e) => {
      if (autoReconnectToggle) {
        autoReconnectToggle.checked = e.target.checked;
      }
      localStorage.setItem('mc_bot_auto_reconnect', e.target.checked);
    });
  }


  // Đóng container captcha bản đồ
  const btnCloseCaptcha = document.getElementById('btn-close-captcha');
  const captchaContainer = document.getElementById('captcha-container');
  if (btnCloseCaptcha && captchaContainer) {
    btnCloseCaptcha.addEventListener('click', () => {
      captchaContainer.classList.add('hidden');
    });
  }

  // --- Hàm chèn log chat vào giao diện ---
  function appendChatLog(sender, message, type = 'other', time = '', prefix = '', receiver = '') {
    if (!time) {
      time = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    }

    // Lưu vào lịch sử chat
    chatHistory.push({ sender, message, type, time, prefix, receiver });

    // Giới hạn lịch sử lưu trữ để tránh tràn bộ nhớ
    if (chatHistory.length > 500) {
      chatHistory.shift();
    }

    // Hiển thị badge đếm tin nhắn riêng chưa đọc nếu đang ở tab khác
    if (type === 'private' && activeChatTab !== 'private') {
      unreadPrivateCount++;
      if (privateBadge) {
        privateBadge.textContent = unreadPrivateCount;
        privateBadge.classList.remove('hidden');
      }
    }

    // Xác định xem có vẽ tin nhắn này vào màn hình hiện tại hay không
    const shouldDraw = activeChatTab === 'all' ||
      (activeChatTab === 'public' && (type === 'public' || type === 'other' || type === 'bot')) ||
      (activeChatTab === 'private' && type === 'private') ||
      (activeChatTab === 'system' && type === 'system');

    if (shouldDraw) {
      appendDivToChatLog(sender, message, type, time, prefix, receiver);
    }
  }

  // Hàm vẽ phần tử tin nhắn thực tế vào DOM
  function appendDivToChatLog(sender, message, type, time, prefix = '', receiver = '') {
    if (!chatLog) return;

    // Xóa dòng thông báo ban đầu nếu có
    if (chatLog.innerHTML.includes('Chưa khởi động bot để ghi nhật ký chat') || chatLog.innerHTML.includes('Console initialized.') || chatLog.innerHTML.includes('Không có tin nhắn')) {
      chatLog.innerHTML = '';
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'p-0.5 rounded transition hover:bg-zinc-900/50 flex flex-wrap items-start text-[11px] leading-relaxed';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'text-zinc-600 mr-1.5 font-mono shrink-0 mt-0.5';
    timeSpan.textContent = `[${time}]`;
    messageDiv.appendChild(timeSpan);

    // Render prefix nếu có (ví dụ: [G], [Kênh Chung])
    if (prefix) {
      const prefixSpan = document.createElement('span');
      prefixSpan.className = 'text-zinc-550 mr-1 shrink-0 font-medium';
      prefixSpan.textContent = prefix;
      messageDiv.appendChild(prefixSpan);
    }

    const senderSpan = document.createElement('span');
    senderSpan.className = 'font-semibold mr-1 shrink-0';

    const messageSpan = document.createElement('span');
    messageSpan.className = 'break-all';

    // Phân loại style cho từng loại người gửi (hợp tone màu tím/hồng Salarixi)
    if (type === 'private') {
      senderSpan.className = 'text-pink-500 font-bold mr-1.5 shrink-0 px-1 py-0.5 bg-pink-950/20 border border-pink-900/35 rounded text-[10px]';
      if (receiver) {
        senderSpan.textContent = `[Nhắn riêng: ${sender} -> ${receiver}]`;
      } else {
        senderSpan.textContent = `[Nhắn riêng]`;
      }
      messageSpan.textContent = message;
      messageSpan.className = 'text-pink-400 font-semibold';
    } else if (type === 'system') {
      senderSpan.textContent = '[Hệ thống]';
      senderSpan.className = 'text-purpleAccent font-semibold mr-1.5 shrink-0';
      messageSpan.textContent = message;
      messageSpan.className = 'text-zinc-400 italic';
    } else if (type === 'bot') {
      senderSpan.textContent = `<${sender}>`;
      senderSpan.className = 'text-violet-400 font-semibold mr-1.5 shrink-0';
      messageSpan.textContent = message;
      messageSpan.className = 'text-violet-200';
    } else if (sender === 'Lỗi') {
      senderSpan.textContent = `[Lỗi]`;
      senderSpan.className = 'text-red-500 font-semibold mr-1.5 shrink-0';
      messageSpan.textContent = message;
      messageSpan.className = 'text-red-400';
    } else {
      senderSpan.textContent = `<${sender}>`;
      senderSpan.className = 'text-indigo-400 font-semibold mr-1.5 shrink-0';
      messageSpan.textContent = message;
      messageSpan.className = 'text-zinc-350';
    }

    messageDiv.appendChild(senderSpan);
    messageDiv.appendChild(messageSpan);
    chatLog.appendChild(messageDiv);

    // Tự động cuộn xuống dưới cùng
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  // --- Khởi tạo Giao diện Hòm đồ & các tác vụ ---
  let currentInventoryData = Array(46).fill(null);

  const inventoryMainGrid = document.getElementById('inventory-main-grid');
  const inventoryHotbarGrid = document.getElementById('inventory-hotbar-grid');
  
  if (inventoryMainGrid) {
    for (let i = 9; i <= 35; i++) {
      const slotDiv = document.createElement('div');
      slotDiv.id = `inv-slot-${i}`;
      slotDiv.className = 'inv-slot w-12 h-12 md:w-14 md:h-14 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center relative cursor-pointer hover:border-purpleAccent transition';
      slotDiv.setAttribute('data-slot', i);
      slotDiv.innerHTML = `<span class="text-[9px] text-zinc-700 font-mono">${i}</span>`;
      inventoryMainGrid.appendChild(slotDiv);
    }
  }

  if (inventoryHotbarGrid) {
    for (let i = 36; i <= 44; i++) {
      const slotDiv = document.createElement('div');
      slotDiv.id = `inv-slot-${i}`;
      slotDiv.className = 'inv-slot w-12 h-12 md:w-14 md:h-14 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center relative cursor-pointer hover:border-purpleAccent transition border-zinc-700';
      slotDiv.setAttribute('data-slot', i);
      slotDiv.innerHTML = `<span class="text-[9px] text-zinc-700 font-mono">${i - 36 + 1}</span>`;
      inventoryHotbarGrid.appendChild(slotDiv);
    }
  }

  function getItemEmoji(name) {
    if (!name) return '📦';
    const n = name.toLowerCase();
    if (n.includes('sword')) return '⚔️';
    if (n.includes('axe')) return '🪓';
    if (n.includes('pickaxe')) return '⛏️';
    if (n.includes('shovel')) return '🥄';
    if (n.includes('helmet')) return '🪖';
    if (n.includes('chestplate')) return '👕';
    if (n.includes('leggings')) return '👖';
    if (n.includes('boots')) return '🥾';
    if (n.includes('totem')) return '🗿';
    if (n.includes('shield')) return '🛡️';
    if (n.includes('map')) return '🗺️';
    if (n.includes('apple')) return '🍎';
    if (n.includes('carrot')) return '🥕';
    if (n.includes('beef') || n.includes('porkchop') || n.includes('mutton') || n.includes('steak')) return '🥩';
    if (n.includes('chicken')) return '🍗';
    if (n.includes('bread')) return '🍞';
    if (n.includes('bow')) return '🏹';
    if (n.includes('arrow')) return '➦';
    if (n.includes('bucket')) return '🪣';
    if (n.includes('coal') || n.includes('charcoal')) return '🪨';
    if (n.includes('diamond')) return '💎';
    if (n.includes('emerald')) return '💚';
    if (n.includes('nether_star') || n.includes('star')) return '⭐';
    if (n.includes('potion')) return '🧪';
    if (n.includes('egg')) return '🥚';
    if (n.includes('pearl')) return '🔮';
    if (n.includes('shulker') || n.includes('chest')) return '📦';
    if (n.includes('golden') || n.includes('gold')) return '🪙';
    if (n.includes('iron')) return '🪙';
    if (n.includes('wood') || n.includes('plank') || n.includes('log')) return '🪵';
    if (n.includes('stone') || n.includes('cobblestone')) return '🪨';
    return '🏷️';
  }

  function getShortName(name) {
    if (!name) return '';
    if (name.length <= 8) return name;
    return name.substring(0, 7) + '..';
  }

  if (socket) {
    socket.on('bot-inventory', (inventoryData) => {
      currentInventoryData = inventoryData;
      inventoryData.forEach((item, index) => {
        const slotDiv = document.getElementById(`inv-slot-${index}`);
        if (!slotDiv) return;

        if (item) {
          const emoji = getItemEmoji(item.name);
          slotDiv.innerHTML = `
            <div class="flex flex-col items-center justify-center w-full h-full p-1 select-none">
              <span class="text-lg">${emoji}</span>
              <span class="text-[8px] text-zinc-400 font-mono truncate max-w-full text-center leading-none mt-0.5">${getShortName(item.displayName)}</span>
              ${item.count > 1 ? `<span class="absolute bottom-0.5 right-1 bg-zinc-950/95 text-[9px] px-1 rounded font-mono font-bold text-zinc-300 leading-none">${item.count}</span>` : ''}
            </div>
          `;
          slotDiv.setAttribute('title', `${item.displayName} (Số lượng: ${item.count})`);
          slotDiv.classList.remove('bg-zinc-900');
          slotDiv.classList.add('bg-zinc-950', 'border-zinc-700');
        } else {
          let label = '';
          if (index === 5) label = 'Mũ';
          else if (index === 6) label = 'Áo';
          else if (index === 7) label = 'Quần';
          else if (index === 8) label = 'Ủng';
          else if (index === 45) label = 'Phụ';
          else if (index >= 36 && index <= 44) label = `${index - 36 + 1}`;
          else label = `${index}`;

          slotDiv.innerHTML = `<span class="text-[9px] text-zinc-700 font-mono">${label}</span>`;
          slotDiv.removeAttribute('title');
          slotDiv.classList.remove('bg-zinc-950', 'border-zinc-700');
          slotDiv.classList.add('bg-zinc-900');
        }
      });
    });

    socket.on('tpa-request', (data) => {
      const { sender, type } = data;
      console.log('[TPA] Nhận yêu cầu TPA từ:', sender, 'Loại:', type);

      const requestTypeStr = type === 'tpa' 
        ? 'muốn dịch chuyển đến vị trí của Bot' 
        : 'muốn Bot dịch chuyển đến vị trí của họ';

      // Tạo một phần tử toast banner
      const toast = document.createElement('div');
      toast.className = 'bg-zinc-950/90 backdrop-blur-md border border-zinc-850 rounded-xl p-4 shadow-2xl flex flex-col gap-3 pointer-events-auto transition-all duration-300 transform translate-y-4 opacity-0 border-purple-glow';
      
      toast.innerHTML = `
        <div class="flex justify-between items-start">
          <div class="flex gap-2 items-center">
            <span class="text-base">🔔</span>
            <div class="flex flex-col">
              <span class="text-xs font-bold text-zinc-200 uppercase tracking-wider font-mono">Yêu cầu TPA</span>
              <span class="text-[10px] text-zinc-400 mt-0.5"><span class="text-purpleAccent font-bold font-mono">${sender}</span> ${requestTypeStr}.</span>
            </div>
          </div>
          <button class="btn-close-toast text-zinc-500 hover:text-zinc-300 transition text-[10px] p-0.5 font-mono select-none">✕</button>
        </div>
        <div class="flex gap-2 border-t border-zinc-900/50 pt-2.5">
          <button class="btn-accept-toast flex-1 bg-green-500/20 hover:bg-green-500/35 text-green-400 border border-green-550/30 font-bold uppercase tracking-widest text-[9px] py-1.5 rounded transition active:scale-95">
            Đồng ý
          </button>
          <button class="btn-deny-toast flex-1 bg-red-500/20 hover:bg-red-500/35 text-red-400 border border-red-550/30 font-bold uppercase tracking-widest text-[9px] py-1.5 rounded transition active:scale-95">
            Từ chối
          </button>
        </div>
      `;

      if (tpaNotificationContainer) {
        tpaNotificationContainer.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => {
          toast.classList.remove('translate-y-4', 'opacity-0');
          toast.classList.add('translate-y-0', 'opacity-100');
        }, 10);

        // Auto remove timer
        let autoRemoveTimer = setTimeout(() => {
          removeToast();
        }, 15000);

        function removeToast() {
          toast.classList.remove('translate-y-0', 'opacity-100');
          toast.classList.add('translate-y-4', 'opacity-0');
          setTimeout(() => {
            toast.remove();
          }, 300);
          clearTimeout(autoRemoveTimer);
        }

        // Event listeners inside toast
        toast.querySelector('.btn-close-toast').addEventListener('click', removeToast);
        
        toast.querySelector('.btn-accept-toast').addEventListener('click', () => {
          if (socket && socket.connected) {
            socket.emit('tpa-action', { action: 'accept', sender });
            appendChatLog('System', `Đã đồng ý yêu cầu dịch chuyển từ: ${sender}`, 'system');
          }
          removeToast();
        });

        toast.querySelector('.btn-deny-toast').addEventListener('click', () => {
          if (socket && socket.connected) {
            socket.emit('tpa-action', { action: 'deny', sender });
            appendChatLog('System', `Đã từ chối yêu cầu dịch chuyển từ: ${sender}`, 'system');
          }
          removeToast();
        });
      }
    });
  }

  // Sự kiện click slot hòm đồ
  let selectedSlotIndex = null;
  document.addEventListener('click', (e) => {
    const slotDiv = e.target.closest('.inv-slot');
    if (!slotDiv) return;

    const slotIndex = parseInt(slotDiv.getAttribute('data-slot'));
    if (isNaN(slotIndex)) return;

    const item = currentInventoryData[slotIndex];
    if (!item) return;

    selectedSlotIndex = slotIndex;
    
    const modal = document.getElementById('inv-action-modal');
    const nameEl = document.getElementById('inv-action-item-name');
    const slotEl = document.getElementById('inv-action-item-slot');
    const emojiEl = document.getElementById('inv-action-item-emoji');

    if (modal && nameEl && slotEl && emojiEl) {
      nameEl.textContent = item.displayName;
      slotEl.textContent = `Slot: #${slotIndex} | Tên gốc: ${item.name}`;
      emojiEl.textContent = getItemEmoji(item.name);
      modal.classList.remove('hidden');
    }
  });

  const btnCloseInvModal = document.getElementById('btn-close-inv-modal');
  const invActionModal = document.getElementById('inv-action-modal');
  if (btnCloseInvModal && invActionModal) {
    btnCloseInvModal.addEventListener('click', () => {
      invActionModal.classList.add('hidden');
    });
  }

  const btnInvEquipHand = document.getElementById('btn-inv-equip-hand');
  const btnInvEquipOffhand = document.getElementById('btn-inv-equip-offhand');
  const btnInvUse = document.getElementById('btn-inv-use');
  const btnInvDrop = document.getElementById('btn-inv-drop');

  if (btnInvEquipHand) {
    btnInvEquipHand.addEventListener('click', () => {
      if (selectedSlotIndex !== null && socket) {
        socket.emit('inventory-action', { slot: selectedSlotIndex, action: 'equip-hand' });
        invActionModal.classList.add('hidden');
      }
    });
  }

  if (btnInvEquipOffhand) {
    btnInvEquipOffhand.addEventListener('click', () => {
      if (selectedSlotIndex !== null && socket) {
        socket.emit('inventory-action', { slot: selectedSlotIndex, action: 'equip-offhand' });
        invActionModal.classList.add('hidden');
      }
    });
  }

  if (btnInvUse) {
    btnInvUse.addEventListener('click', () => {
      if (selectedSlotIndex !== null && socket) {
        socket.emit('inventory-action', { slot: selectedSlotIndex, action: 'use' });
        invActionModal.classList.add('hidden');
      }
    });
  }

  if (btnInvDrop) {
    btnInvDrop.addEventListener('click', () => {
      if (selectedSlotIndex !== null && socket) {
        socket.emit('inventory-action', { slot: selectedSlotIndex, action: 'drop' });
        invActionModal.classList.add('hidden');
      }
    });
  }

  // --- Điều khiển di chuyển & Xoay nhìn Bot (Controls & Movement) ---
  const activeKeys = {};
  const activeRotations = {
    left: false,
    right: false,
    up: false,
    down: false
  };
  let rotationInterval = null;

  const startRotationLoop = () => {
    if (rotationInterval) return;
    rotationInterval = setInterval(() => {
      let yawDelta = 0;
      let pitchDelta = 0;
      
      // Tốc độ xoay (radians mỗi 50ms)
      const ROT_SPEED = 0.06;

      if (activeRotations.left) yawDelta += ROT_SPEED;
      if (activeRotations.right) yawDelta -= ROT_SPEED;
      if (activeRotations.up) pitchDelta -= ROT_SPEED;   // Up trong mineflayer là pitch âm
      if (activeRotations.down) pitchDelta += ROT_SPEED;  // Down trong mineflayer là pitch dương

      if (yawDelta !== 0 || pitchDelta !== 0) {
        if (socket) socket.emit('bot-rotate', { yawDelta, pitchDelta });
      } else {
        stopRotationLoop();
      }
    }, 50);
  };

  const stopRotationLoop = () => {
    if (!activeRotations.left && !activeRotations.right && !activeRotations.up && !activeRotations.down) {
      if (rotationInterval) {
        clearInterval(rotationInterval);
        rotationInterval = null;
      }
    }
  };

  window.addEventListener('keydown', (e) => {
    // Không bắt phím khi đang gõ chat hoặc nhập liệu cấu hình
    if (
      document.activeElement.tagName === 'INPUT' ||
      document.activeElement.tagName === 'SELECT' ||
      document.activeElement.tagName === 'TEXTAREA' ||
      document.activeElement.isContentEditable
    ) {
      return;
    }

    // --- DI CHUYỂN (Movement) ---
    const key = e.key.toLowerCase();
    let direction = null;

    if (key === 'w') direction = 'forward';
    else if (key === 's') direction = 'back';
    else if (key === 'a') direction = 'left';
    else if (key === 'd') direction = 'right';
    else if (e.key === ' ' || e.key === 'Spacebar') direction = 'jump';
    else if (e.key === 'Shift') direction = 'sneak';
    else if (e.key === 'Control') direction = 'sprint';

    if (direction) {
      if (!activeKeys[direction]) {
        activeKeys[direction] = true;
        if (socket) socket.emit('bot-move', { direction, state: true });
        const btn = document.getElementById(`btn-move-${direction}`);
        if (btn) btn.classList.add('bg-purpleAccent', 'text-white', 'border-purpleGlow');
      }
      if (e.key === ' ' || e.key === 'Control') e.preventDefault(); // Tránh cuộn trang hoặc shortcut browser
      return;
    }

    // --- XOAY NHÌN (Rotation) ---
    let rotateDir = null;
    if (e.key === 'ArrowUp') rotateDir = 'up';
    else if (e.key === 'ArrowDown') rotateDir = 'down';
    else if (e.key === 'ArrowLeft') rotateDir = 'left';
    else if (e.key === 'ArrowRight') rotateDir = 'right';

    if (rotateDir) {
      e.preventDefault(); // Tránh cuộn trang
      if (!activeRotations[rotateDir]) {
        activeRotations[rotateDir] = true;
        const btn = document.getElementById(`btn-look-${rotateDir}`);
        if (btn) btn.classList.add('bg-purpleAccent', 'text-white', 'border-purpleGlow');
        startRotationLoop();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    // --- DI CHUYỂN (Movement) ---
    const key = e.key.toLowerCase();
    let direction = null;

    if (key === 'w') direction = 'forward';
    else if (key === 's') direction = 'back';
    else if (key === 'a') direction = 'left';
    else if (key === 'd') direction = 'right';
    else if (e.key === ' ' || e.key === 'Spacebar') direction = 'jump';
    else if (e.key === 'Shift') direction = 'sneak';
    else if (e.key === 'Control') direction = 'sprint';

    if (direction) {
      if (activeKeys[direction]) {
        activeKeys[direction] = false;
        if (socket) socket.emit('bot-move', { direction, state: false });
        const btn = document.getElementById(`btn-move-${direction}`);
        if (btn) btn.classList.remove('bg-purpleAccent', 'text-white', 'border-purpleGlow');
      }
      return;
    }

    // --- XOAY NHÌN (Rotation) ---
    let rotateDir = null;
    if (e.key === 'ArrowUp') rotateDir = 'up';
    else if (e.key === 'ArrowDown') rotateDir = 'down';
    else if (e.key === 'ArrowLeft') rotateDir = 'left';
    else if (e.key === 'ArrowRight') rotateDir = 'right';

    if (rotateDir) {
      if (activeRotations[rotateDir]) {
        activeRotations[rotateDir] = false;
        const btn = document.getElementById(`btn-look-${rotateDir}`);
        if (btn) btn.classList.remove('bg-purpleAccent', 'text-white', 'border-purpleGlow');
        stopRotationLoop();
      }
    }
  });

  const resetAllLocalControls = () => {
    // Reset di chuyển
    ['forward', 'back', 'left', 'right', 'jump', 'sneak', 'sprint'].forEach(direction => {
      if (activeKeys[direction]) {
        activeKeys[direction] = false;
        if (socket) socket.emit('bot-move', { direction, state: false });
        const btn = document.getElementById(`btn-move-${direction}`);
        if (btn) btn.classList.remove('bg-purpleAccent', 'text-white', 'border-purpleGlow');
      }
    });

    // Reset xoay nhìn
    ['up', 'down', 'left', 'right'].forEach(direction => {
      if (activeRotations[direction]) {
        activeRotations[direction] = false;
        const btn = document.getElementById(`btn-look-${direction}`);
        if (btn) btn.classList.remove('bg-purpleAccent', 'text-white', 'border-purpleGlow');
      }
    });
    
    stopRotationLoop();
  };

  window.addEventListener('blur', resetAllLocalControls);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      resetAllLocalControls();
    }
  });

  const bindMoveButton = (id, direction) => {
    const btn = document.getElementById(id);
    if (!btn) return;

    const startMove = (e) => {
      e.preventDefault();
      if (!activeKeys[direction]) {
        activeKeys[direction] = true;
        if (socket) socket.emit('bot-move', { direction, state: true });
        btn.classList.add('bg-purpleAccent', 'text-white', 'border-purpleGlow');
      }
    };

    const stopMove = (e) => {
      e.preventDefault();
      if (activeKeys[direction]) {
        activeKeys[direction] = false;
        if (socket) socket.emit('bot-move', { direction, state: false });
        btn.classList.remove('bg-purpleAccent', 'text-white', 'border-purpleGlow');
      }
    };

    btn.addEventListener('mousedown', startMove);
    btn.addEventListener('mouseup', stopMove);
    btn.addEventListener('mouseleave', stopMove);

    btn.addEventListener('touchstart', startMove, { passive: false });
    btn.addEventListener('touchend', stopMove, { passive: false });
    btn.addEventListener('touchcancel', stopMove, { passive: false });
  };

  const bindLookButton = (id, direction) => {
    const btn = document.getElementById(id);
    if (!btn) return;

    const startRot = (e) => {
      e.preventDefault();
      if (!activeRotations[direction]) {
        activeRotations[direction] = true;
        btn.classList.add('bg-purpleAccent', 'text-white', 'border-purpleGlow');
        startRotationLoop();
      }
    };

    const stopRot = (e) => {
      e.preventDefault();
      if (activeRotations[direction]) {
        activeRotations[direction] = false;
        btn.classList.remove('bg-purpleAccent', 'text-white', 'border-purpleGlow');
        stopRotationLoop();
      }
    };

    btn.addEventListener('mousedown', startRot);
    btn.addEventListener('mouseup', stopRot);
    btn.addEventListener('mouseleave', stopRot);

    btn.addEventListener('touchstart', startRot, { passive: false });
    btn.addEventListener('touchend', stopRot, { passive: false });
    btn.addEventListener('touchcancel', stopRot, { passive: false });
  };

  bindMoveButton('btn-move-forward', 'forward');
  bindMoveButton('btn-move-back', 'back');
  bindMoveButton('btn-move-left', 'left');
  bindMoveButton('btn-move-right', 'right');
  bindMoveButton('btn-move-jump', 'jump');
  bindMoveButton('btn-move-sneak', 'sneak');
  bindMoveButton('btn-move-sprint', 'sprint');

  bindLookButton('btn-look-up', 'up');
  bindLookButton('btn-look-down', 'down');
  bindLookButton('btn-look-left', 'left');
  bindLookButton('btn-look-right', 'right');

  const btnMoveStop = document.getElementById('btn-move-stop');
  if (btnMoveStop) {
    btnMoveStop.addEventListener('click', () => {
      // Dừng mọi phím di chuyển
      ['forward', 'back', 'left', 'right', 'jump', 'sneak', 'sprint'].forEach(direction => {
        activeKeys[direction] = false;
        
        const btn = document.getElementById(`btn-move-${direction}`);
        if (btn) {
          btn.classList.remove('bg-purpleAccent', 'text-white', 'border-purpleGlow');
        }
      });

      // Dừng mọi xoay nhìn
      ['up', 'down', 'left', 'right'].forEach(direction => {
        activeRotations[direction] = false;
        const btn = document.getElementById(`btn-look-${direction}`);
        if (btn) {
          btn.classList.remove('bg-purpleAccent', 'text-white', 'border-purpleGlow');
        }
      });
      stopRotationLoop();

      // Tắt Killaura và AI Sinh tồn checkbox trên giao diện ngay lập tức
      if (killauraToggle) {
        killauraToggle.checked = false;
      }
      if (aisurvivalToggle) {
        aisurvivalToggle.checked = false;
      }

      // Gửi tín hiệu dừng toàn bộ lên backend
      if (socket && socket.connected && isBotOnline) {
        socket.emit('bot-stop-all');
      }
    });
  }
});

