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

  const btnConnectBot = document.getElementById('btn-connect-bot');
  const btnDisconnectBot = document.getElementById('btn-disconnect-bot');

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

  // --- Khởi tạo Địa chỉ Backend URL ---
  // Lấy URL lưu từ localStorage hoặc mặc định là server hiện tại hoặc localhost:3000
  let savedBackendUrl = localStorage.getItem('mc_bot_backend_url');
  if (!savedBackendUrl) {
    savedBackendUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
      ? 'http://localhost:3000' 
      : 'https://minecraft-bot-backend.onrender.com';
  }
  backendUrlInput.value = savedBackendUrl;

  // Tự động tải lại cấu hình Bot đã lưu lần trước từ LocalStorage
  serverIpInput.value = localStorage.getItem('mc_bot_host') || '';
  serverPortInput.value = localStorage.getItem('mc_bot_port') || '25565';
  botUsernameInput.value = localStorage.getItem('mc_bot_username') || '';
  if (botPasswordInput) botPasswordInput.value = localStorage.getItem('mc_bot_password') || '';
  minecraftVersionSelect.value = localStorage.getItem('mc_bot_version') || 'auto';
  
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
      socketDot.className = 'relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500';
      socketPulse.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75';
    } else {
      socketDot.className = 'relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500';
      socketPulse.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75';
    }
  }

  // --- Quản lý trạng thái Bot Minecraft (UI) ---
  let isBotOnline = false;

  function updateBotStatus(status, message) {
    botStatusDesc.textContent = message;
    
    // Reset các class màu sắc trước khi gán
    botPulseRing.className = 'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75';
    botDot.className = 'relative inline-flex rounded-full h-3.5 w-3.5';

    switch (status) {
      case 'online':
        isBotOnline = true;
        botStatusText.textContent = 'ONLINE';
        botStatusText.className = 'text-lg font-bold text-emerald-400';
        botPulseRing.classList.add('bg-emerald-400');
        botDot.classList.add('bg-emerald-500');
        
        // Điều khiển nút & form
        btnConnectBot.disabled = true;
        btnConnectBot.className = 'w-full bg-emerald-800 text-emerald-400 border border-emerald-700/50 cursor-not-allowed font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2';
        btnDisconnectBot.disabled = false;
        btnDisconnectBot.className = 'w-full bg-rose-600 hover:bg-rose-500 text-white font-semibold py-2.5 px-4 rounded-lg transition active:scale-[0.98] flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(239,68,68,0.2)]';
        
        // Bật chat input
        chatInput.disabled = false;
        chatInput.placeholder = 'Nhập tin nhắn để Bot chat...';
        btnSendChat.disabled = false;
        break;

      case 'connecting':
        isBotOnline = false;
        botStatusText.textContent = 'CONNECTING';
        botStatusText.className = 'text-lg font-bold text-amber-400';
        botPulseRing.classList.add('bg-amber-400');
        botDot.classList.add('bg-amber-500');

        // Điều khiển nút & form
        btnConnectBot.disabled = true;
        btnConnectBot.className = 'w-full bg-slate-800 text-slate-500 cursor-not-allowed font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2';
        btnDisconnectBot.disabled = false; // Vẫn cho phép ngắt kết nối khi đang cố gắng kết nối
        btnDisconnectBot.className = 'w-full bg-rose-600 hover:bg-rose-500 text-white font-semibold py-2.5 px-4 rounded-lg transition active:scale-[0.98] flex items-center justify-center gap-2';
        
        // Tắt chat input
        chatInput.disabled = true;
        chatInput.placeholder = 'Đang kết nối bot...';
        btnSendChat.disabled = true;
        break;

      case 'error':
      case 'offline':
      default:
        isBotOnline = false;
        botStatusText.textContent = status === 'error' ? 'ERROR' : 'OFFLINE';
        botStatusText.className = status === 'error' ? 'text-lg font-bold text-rose-500' : 'text-lg font-bold text-slate-400';
        botPulseRing.classList.add(status === 'error' ? 'bg-rose-400' : 'bg-slate-400');
        botDot.classList.add(status === 'error' ? 'bg-rose-500' : 'bg-slate-500');

        // Reset các thông số stats về 0
        resetStats();

        // Điều khiển nút & form
        btnConnectBot.disabled = false;
        btnConnectBot.className = 'w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 px-4 rounded-lg transition active:scale-[0.98] flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.2)]';
        btnDisconnectBot.disabled = true;
        btnDisconnectBot.className = 'w-full bg-rose-600/50 text-rose-300 border border-rose-800/40 cursor-not-allowed font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2';
        
        // Tắt chat input
        chatInput.disabled = true;
        chatInput.placeholder = 'Kết nối bot để bắt đầu nhắn tin...';
        btnSendChat.disabled = true;
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

    // Gửi sự kiện `start-bot` kèm đầy đủ cấu hình nâng cao
    socket.emit('start-bot', { host, port, username, password, version, auth, autoReconnect });
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
    chatLog.innerHTML = '<div class="text-slate-500 italic text-xs">Màn hình chat đã được xóa sạch.</div>';
  });

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
          statHealthBar.className = 'bg-red-600 h-full rounded-full transition-all duration-350 animate-pulse';
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
      const { sender, message, time } = data;
      
      let type = 'other'; // Mặc định là người chơi khác
      if (sender === 'System') {
        type = 'system';
      } else if (sender === botUsernameInput.value.trim() || sender === botStatusDesc.textContent.replace('Đã kết nối thành công với tên: ', '')) {
        type = 'bot';
      }
      
      appendChatLog(sender, message, type, time);
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

    // 5. Ẩn captcha khi bot ngắt kết nối
    socket.on('bot-status', (data) => {
      if (data.status === 'offline' || data.status === 'error') {
        const captchaContainer = document.getElementById('captcha-container');
        if (captchaContainer) captchaContainer.classList.add('hidden');
      }
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
  function appendChatLog(sender, message, type = 'other', time = '') {
    // Xóa dòng thông báo ban đầu nếu có
    if (chatLog.innerHTML.includes('Chưa khởi động bot để ghi nhật ký chat')) {
      chatLog.innerHTML = '';
    }

    if (!time) {
      time = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'p-1 rounded transition hover:bg-slate-900/50 flex flex-wrap items-start text-[13px] leading-relaxed';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'text-slate-600 text-xs mr-2 font-mono shrink-0 mt-0.5';
    timeSpan.textContent = `[${time}]`;
    messageDiv.appendChild(timeSpan);

    const senderSpan = document.createElement('span');
    senderSpan.className = 'font-semibold mr-1.5 shrink-0';

    const messageSpan = document.createElement('span');
    messageSpan.className = 'break-all';

    // Phân loại style cho từng loại người gửi
    if (type === 'system') {
      senderSpan.textContent = '[Hệ thống]';
      senderSpan.className = 'text-amber-500 font-semibold mr-1.5 shrink-0';
      messageSpan.textContent = message;
      messageSpan.className = 'text-slate-400 italic';
    } else if (type === 'bot') {
      senderSpan.textContent = `<${sender}>`;
      senderSpan.className = 'text-cyan-400 font-semibold mr-1.5 shrink-0';
      messageSpan.textContent = message;
      messageSpan.className = 'text-cyan-100';
    } else if (sender === 'Lỗi') {
      senderSpan.textContent = `[Lỗi]`;
      senderSpan.className = 'text-red-500 font-semibold mr-1.5 shrink-0';
      messageSpan.textContent = message;
      messageSpan.className = 'text-red-300';
    } else {
      senderSpan.textContent = `<${sender}>`;
      senderSpan.className = 'text-emerald-400 font-semibold mr-1.5 shrink-0';
      messageSpan.textContent = message;
      messageSpan.className = 'text-slate-200';
    }

    messageDiv.appendChild(senderSpan);
    messageDiv.appendChild(messageSpan);
    chatLog.appendChild(messageDiv);

    // Tự động cuộn xuống dưới cùng
    chatLog.scrollTop = chatLog.scrollHeight;
  }
});
