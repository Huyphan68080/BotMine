const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mineflayer = require('mineflayer');

// Hàm phân tích và chuyển đổi NBT chat component / JSON chat component của Minecraft thành chuỗi thông thường
function parseNbtChat(nbt) {
  if (!nbt) return '';
  if (typeof nbt === 'string') return nbt;
  
  // NBT compound tag đại diện cho Chat Component
  if (nbt.type === 'compound' && nbt.value) {
    let text = '';
    if (nbt.value.text && nbt.value.text.value) {
      text += nbt.value.text.value;
    }
    if (nbt.value.extra && nbt.value.extra.value && nbt.value.extra.value.value) {
      const extraList = nbt.value.extra.value.value;
      if (Array.isArray(extraList)) {
        for (const item of extraList) {
          text += parseNbtChat(item);
        }
      }
    }
    return text;
  }
  
  if (nbt.type === 'string' && nbt.value) {
    return nbt.value;
  }

  // Cấu trúc Chat Component JSON chuẩn (nếu có)
  if (nbt.text !== undefined) {
    let text = nbt.text;
    if (Array.isArray(nbt.extra)) {
      for (const item of nbt.extra) {
        text += parseNbtChat(item);
      }
    }
    return text;
  }
  
  return JSON.stringify(nbt);
}

function parseKickReason(reason) {
  if (!reason) return 'Bị kick không rõ lý do';
  if (typeof reason === 'string') {
    try {
      const parsed = JSON.parse(reason);
      return parseNbtChat(parsed);
    } catch (e) {
      return reason;
    }
  }
  return parseNbtChat(reason);
}

// Khởi tạo ứng dụng Express
const app = express();
const PORT = process.env.PORT || 3000;

// Cấu hình CORS cho Express API
// Cho phép tất cả các nguồn truy cập (có thể giới hạn bằng FRONTEND_URL trong .env khi deploy thực tế)
const allowedOrigins = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : '*';

const corsOptions = {
  origin: allowedOrigins === '*' ? true : allowedOrigins,
  methods: ['GET', 'POST'],
  credentials: true
};

app.use(cors(corsOptions));

// Endpoint /ping để giữ server luôn hoạt động (uptime check trên Render)
app.get('/ping', (req, res) => {
  res.status(200).json({
    status: 'alive',
    message: 'Pong! Server và Bot manager vẫn đang chạy ổn định.',
    timestamp: new Date().toISOString()
  });
});

// Tạo HTTP Server
const server = http.createServer(app);

// Cấu hình Socket.io Server với CORS phù hợp để tránh bị chặn khi Frontend gọi từ Vercel
const io = new Server(server, {
  cors: {
    origin: allowedOrigins === '*' ? (origin, callback) => callback(null, true) : allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Đối tượng lưu trữ các instance Bot Minecraft theo Socket ID
const activeBots = {};
// Lưu trữ cấu hình kết nối để phục vụ tự động kết nối lại
const botConfigs = {};
// Lưu trữ bộ hẹn giờ kết nối lại (reconnect timers)
const reconnectTimers = {};

io.on('connection', (socket) => {
  console.log(`[Socket] Client kết nối mới: ${socket.id}`);

  // Gửi trạng thái ban đầu của bot cho client mới kết nối
  socket.emit('bot-status', { status: 'offline', message: 'Chưa kết nối bot' });

  // Hàm khởi tạo và quản lý kết nối bot Minecraft
  function connectBot(config) {
    const { host, port, username, version, auth, autoReconnect } = config;
    const socketId = socket.id;

    console.log(`[Bot] Khởi tạo kết nối cho ${socketId} -> ${host}:${port || 25565} [Auth: ${auth || 'offline'}, AutoReconnect: ${autoReconnect}]`);

    // Dừng bot cũ nếu có
    if (activeBots[socketId]) {
      try {
        activeBots[socketId].quit();
      } catch (err) {
        console.error('[Bot] Lỗi khi dừng bot cũ:', err.message);
      }
      delete activeBots[socketId];
    }

    // Xóa timer reconnect cũ nếu có
    if (reconnectTimers[socketId]) {
      clearTimeout(reconnectTimers[socketId]);
      delete reconnectTimers[socketId];
    }

    socket.emit('bot-status', { status: 'connecting', message: 'Đang kết nối tới server Minecraft...' });

    // Khởi tạo Mineflayer Bot Options
    const botOptions = {
      host: host,
      port: parseInt(port) || 25565,
      username: username || `Bot_${Math.floor(Math.random() * 1000)}`,
      auth: auth === 'microsoft' ? 'microsoft' : 'offline',
      version: version && version !== 'auto' ? version : false,
      hideErrors: true
    };

    let bot;
    try {
      bot = mineflayer.createBot(botOptions);
      activeBots[socketId] = bot;
      botConfigs[socketId] = config; // Lưu cấu hình lại để reconect
    } catch (error) {
      console.error('[Bot] Khởi tạo mineflayer thất bại:', error.message);
      socket.emit('bot-status', { status: 'error', message: `Không thể tạo Bot: ${error.message}` });
      return;
    }

    // Xử lý sự kiện ngắt kết nối chung (kicked, end, error)
    function handleBotDisconnect(reasonText, isError = false) {
      // Nếu socket client đã ngắt kết nối khỏi server backend, giải phóng tài nguyên ngay
      if (!socket.connected) {
        delete activeBots[socketId];
        delete botConfigs[socketId];
        return;
      }

      delete activeBots[socketId];

      // Nếu người dùng bật Auto Reconnect, thực hiện đếm ngược kết nối lại
      if (autoReconnect) {
        if (!reconnectTimers[socketId]) {
          console.log(`[Bot] Bot của ${socketId} bị ngắt kết nối. Đang tự động kết nối lại sau 5 giây...`);
          socket.emit('bot-status', { 
            status: 'connecting', 
            message: `${reasonText}. Tự động kết nối lại sau 5s...` 
          });

          reconnectTimers[socketId] = setTimeout(() => {
            delete reconnectTimers[socketId];
            if (socket.connected) {
              connectBot(config);
            }
          }, 5000);
        }
      } else {
        socket.emit('bot-status', { 
          status: isError ? 'error' : 'offline', 
          message: reasonText 
        });
      }
    }

    // --- CÁC SỰ KIỆN CỦA BOT ---

    // 1. Khi bot spawn thành công vào game
    bot.on('spawn', () => {
      console.log(`[Bot] Bot [${bot.username}] đã vào server game thành công.`);
      socket.emit('bot-status', { 
        status: 'online', 
        message: `Đã kết nối thành công với tên: ${bot.username}` 
      });

      // Gửi thông số tọa độ ban đầu
      if (bot.entity) {
        socket.emit('bot-info', {
          health: bot.health || 20,
          food: bot.food || 20,
          coords: {
            x: Math.round(bot.entity.position.x * 100) / 100,
            y: Math.round(bot.entity.position.y * 100) / 100,
            z: Math.round(bot.entity.position.z * 100) / 100
          }
        });
      }
    });

    // 2. Cập nhật lượng máu và thức ăn của bot
    bot.on('health', () => {
      socket.emit('bot-info', {
        health: Math.round(bot.health) || 0,
        food: Math.round(bot.food) || 0,
        coords: bot.entity ? {
          x: Math.round(bot.entity.position.x * 100) / 100,
          y: Math.round(bot.entity.position.y * 100) / 100,
          z: Math.round(bot.entity.position.z * 100) / 100
        } : null
      });
    });

    // 3. Cập nhật tọa độ khi bot di chuyển
    let lastPosition = null;
    bot.on('move', () => {
      if (bot.entity) {
        const pos = bot.entity.position;
        if (!lastPosition || 
            Math.abs(pos.x - lastPosition.x) > 0.1 || 
            Math.abs(pos.y - lastPosition.y) > 0.1 || 
            Math.abs(pos.z - lastPosition.z) > 0.1) {
          
          lastPosition = pos.clone();
          socket.emit('bot-info', {
            health: Math.round(bot.health) || 0,
            food: Math.round(bot.food) || 0,
            coords: {
              x: Math.round(pos.x * 100) / 100,
              y: Math.round(pos.y * 100) / 100,
              z: Math.round(pos.z * 100) / 100
            }
          });
        }
      }
    });

    // 4. Nhận tin nhắn chat từ những người chơi khác
    bot.on('chat', (username, message) => {
      // Bỏ qua tin nhắn do chính bot gửi để tránh lặp
      if (username === bot.username) return;

      socket.emit('bot-chat', {
        sender: username,
        message: message,
        time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
      });
    });

    // 5. Nhận toàn bộ log tin nhắn thô (hệ thống, thông báo server...)
    bot.on('messagestr', (messageStr) => {
      if (!messageStr.trim()) return;
      
      const isNormalChat = messageStr.includes('<') && messageStr.includes('>');
      if (!isNormalChat) {
        socket.emit('bot-chat', {
          sender: 'System',
          message: messageStr,
          time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
        });
      }
    });

    // 6. Khi bot bị kick khỏi server
    bot.on('kicked', (reason) => {
      const parsedReason = parseKickReason(reason);
      console.log(`[Bot] Bot bị kick khỏi server. Lý do: ${parsedReason}`);
      handleBotDisconnect(`Bot bị kick! Lý do: ${parsedReason}`);
    });

    // 7. Khi kết nối bot kết thúc (bị ngắt kết nối)
    bot.on('end', (reason) => {
      console.log(`[Bot] Kết nối của bot kết thúc: ${reason || 'Ngắt kết nối'}`);
      handleBotDisconnect(`Bot đã ngắt kết nối: ${reason || 'Mất kết nối đột ngột'}`);
    });

    // 8. Khi bot gặp lỗi (sai IP, port, server sập...)
    bot.on('error', (err) => {
      console.error(`[Bot] Lỗi kết nối bot: ${err.message}`);
      handleBotDisconnect(`Lỗi kết nối: ${err.message}`, true);
    });
  }

  // Nhận yêu cầu khởi tạo bot từ client
  socket.on('start-bot', (config) => {
    connectBot(config);
  });

  // Lắng nghe lệnh gửi chat từ Frontend để bot phát ngôn
  socket.on('send-chat', (message) => {
    const bot = activeBots[socket.id];
    if (bot) {
      console.log(`[Bot] Bot ${bot.username} gửi chat: ${message}`);
      try {
        bot.chat(message);
        // Gửi lại tin nhắn này lên frontend của chính mình để cập nhật chat log
        socket.emit('bot-chat', {
          sender: bot.username,
          message: message,
          time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
        });
      } catch (err) {
        console.error('[Bot] Lỗi khi gửi chat:', err.message);
        socket.emit('bot-chat', {
          sender: 'Lỗi',
          message: `Không thể gửi tin nhắn: ${err.message}`,
          time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
        });
      }
    } else {
      socket.emit('bot-status', { status: 'offline', message: 'Chưa có bot nào đang chạy để gửi chat!' });
    }
  });

  // Lắng nghe yêu cầu dừng bot thủ công từ người dùng
  socket.on('stop-bot', () => {
    const socketId = socket.id;
    
    // Tắt tự động kết nối lại vì người dùng chủ động ngắt kết nối
    if (botConfigs[socketId]) {
      botConfigs[socketId].autoReconnect = false;
    }

    // Xóa timer reconnect nếu đang chạy
    if (reconnectTimers[socketId]) {
      clearTimeout(reconnectTimers[socketId]);
      delete reconnectTimers[socketId];
    }

    const bot = activeBots[socketId];
    if (bot) {
      console.log(`[Bot] Người dùng yêu cầu dừng bot của socket: ${socketId}`);
      try {
        bot.quit();
      } catch (err) {
        console.error('[Bot] Lỗi khi quit bot:', err.message);
      }
      delete activeBots[socketId];
      socket.emit('bot-status', { status: 'offline', message: 'Đã chủ động ngắt kết nối bot.' });
    }
  });

  // Khi người dùng đóng tab / ngắt kết nối Socket.io
  socket.on('disconnect', () => {
    console.log(`[Socket] Client ngắt kết nối: ${socket.id}`);
    const socketId = socket.id;

    // Xóa timer reconnect
    if (reconnectTimers[socketId]) {
      clearTimeout(reconnectTimers[socketId]);
      delete reconnectTimers[socketId];
    }

    const bot = activeBots[socketId];
    if (bot) {
      console.log(`[Bot] Tự động giải phóng bot của socket ${socketId} do ngắt kết nối web.`);
      try {
        bot.quit();
      } catch (err) {
        console.error('[Bot] Lỗi khi tự động quit bot:', err.message);
      }
      delete activeBots[socketId];
    }
    delete botConfigs[socketId];
  });
});

// Chạy server lắng nghe
server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(` Minecraft Bot Manager Backend is running on port ${PORT}`);
  console.log(` Endpoint ping: http://localhost:${PORT}/ping`);
  console.log(` Môi trường CORS allowed origins: ${allowedOrigins}`);
  console.log(`===================================================`);
});
