// Hook minecraft-data to support Minecraft 26.x and 26.0 versions
try {
  require('minecraft-data');
  const mcDataModule = require.cache[require.resolve('minecraft-data')];
  if (mcDataModule) {
    const originalExport = mcDataModule.exports;
    const wrappedExport = function (mcVersion, preNetty) {
      let targetVersion = mcVersion;
      if (mcVersion === '26.0') {
        targetVersion = '26.1';
      }
      const isVersion26 = typeof targetVersion === 'string' && targetVersion.startsWith('26');
      if (isVersion26) {
        const verMeta = originalExport.versionsByMinecraftVersion.pc[targetVersion];
        if (verMeta) {
          const baseData = originalExport('1.21.11', preNetty);
          if (baseData) {
            const newData = {
              ...baseData,
              version: Object.assign({}, baseData.version, {
                minecraftVersion: targetVersion,
                version: verMeta.version,
                dataVersion: verMeta.dataVersion,
                majorVersion: '1.21' // Fallback to 1.21 majorVersion for compatibility
              })
            };
            const supportFeature = require('minecraft-data/lib/supportsFeature');
            newData.supportFeature = supportFeature(newData.version, originalExport.versions.pc);
            return newData;
          }
        }
      }
      return originalExport(mcVersion, preNetty);
    };
    Object.assign(wrappedExport, originalExport);
    mcDataModule.exports = wrappedExport;
  }
} catch (err) {
  console.error('[Cảnh báo] Lỗi khi hook minecraft-data:', err.message);
}

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mineflayer = require('mineflayer');


// Hàm phân tích và đệ quy trích xuất chuỗi từ bất kỳ đối tượng Chat Component / NBT nào của Minecraft
function extractAllStrings(obj) {
  if (obj === null || obj === undefined) return '';
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  
  if (Array.isArray(obj)) {
    return obj.map(extractAllStrings).join('');
  }
  
  if (typeof obj === 'object') {
    // Nếu đối tượng có thuộc tính "value" đại diện cho giá trị thực tế của NBT Tag
    if (obj.value !== undefined) {
      if (typeof obj.value === 'string') return obj.value;
      return extractAllStrings(obj.value);
    }
    
    // Nếu là Chat Component JSON chuẩn với translate
    if (obj.translate !== undefined && typeof obj.translate === 'string') {
      let result = '';
      if (obj.translate === 'disconnect.genericReason' && obj.with) {
        result = extractAllStrings(obj.with);
      } else {
        result = obj.translate;
        if (obj.with) {
          result += ': ' + extractAllStrings(obj.with);
        }
      }
      if (Array.isArray(obj.extra)) {
        result += extractAllStrings(obj.extra);
      }
      return result;
    }

    // Nếu là Chat Component JSON chuẩn với text
    if (obj.text !== undefined && typeof obj.text === 'string') {
      let result = obj.text;
      if (Array.isArray(obj.extra)) {
        result += extractAllStrings(obj.extra);
      }
      return result;
    }
    
    let result = '';
    // Thử truy xuất các trường phổ biến
    if (obj.text) result += extractAllStrings(obj.text);
    if (obj.translate) result += extractAllStrings(obj.translate);
    if (obj.extra) result += extractAllStrings(obj.extra);
    if (obj[""]) result += extractAllStrings(obj[""]);
    
    if (result) return result;
    
    // Fallback: Quét toàn bộ thuộc tính để tìm chuỗi
    let keys = Object.keys(obj);
    for (let key of keys) {
      if (key === 'type') continue; // Bỏ qua nhãn định dạng kiểu dữ liệu
      const val = obj[key];
      if (typeof val === 'string') {
        result += val;
      } else if (typeof val === 'object') {
        result += extractAllStrings(val);
      }
    }
    return result;
  }
  
  return '';
}

function parseKickReason(reason) {
  if (!reason) return 'Bị kick không rõ lý do';
  if (typeof reason === 'string') {
    try {
      const parsed = JSON.parse(reason);
      return extractAllStrings(parsed);
    } catch (e) {
      return reason;
    }
  }
  return extractAllStrings(reason);
}

function getEntityName(entity) {
  if (!entity) return null;
  let name = null;
  if (typeof entity.getCustomName === 'function') {
    const cn = entity.getCustomName();
    if (cn) name = cn;
  }
  if (!name && entity.customName) name = entity.customName;
  if (!name && entity.displayName) name = entity.displayName;
  
  if (!name) return null;
  
  if (typeof name === 'object') {
    return extractAllStrings(name);
  }
  
  if (typeof name === 'string') {
    try {
      const parsed = JSON.parse(name);
      return extractAllStrings(parsed);
    } catch (e) {
      return name;
    }
  }
  return String(name);
}

// Hàm tự động phát hiện và giải quyết Captcha dạng văn bản bằng Regex
function checkAndSolveCaptcha(messageStr, bot) {
  if (!messageStr || !bot) return;

  // 1. Dạng phổ biến: /captcha XXXX hoặc /capcha XXXX (dấu gạch chéo có thể có hoặc không)
  const captchaRegex = /[\/\\]capc?ha\s+([a-zA-Z0-9]+)/i;
  let match = messageStr.match(captchaRegex);
  if (match && match[1]) {
    const code = match[1];
    console.log(`[Auto-Captcha] Phát hiện mã captcha: ${code}. Đang tự động gửi...`);
    setTimeout(() => {
      try {
        bot.chat(`/captcha ${code}`);
      } catch (err) {
        console.error('[Auto-Captcha] Gửi captcha thất bại:', err.message);
      }
    }, 1000);
    return;
  }

  // 2. Dạng: /verify XXXX
  const verifyRegex = /[\/\\]verify\s+([a-zA-Z0-9]+)/i;
  match = messageStr.match(verifyRegex);
  if (match && match[1]) {
    const code = match[1];
    console.log(`[Auto-Captcha] Phát hiện mã verify: ${code}. Đang tự động gửi...`);
    setTimeout(() => {
      try {
        bot.chat(`/verify ${code}`);
      } catch (err) {
        console.error('[Auto-Captcha] Gửi verify thất bại:', err.message);
      }
    }, 1000);
    return;
  }

  // 3. Dạng: /confirm XXXX
  const confirmRegex = /[\/\\]confirm\s+([a-zA-Z0-9]+)/i;
  match = messageStr.match(confirmRegex);
  if (match && match[1]) {
    const code = match[1];
    console.log(`[Auto-Captcha] Phát hiện mã confirm: ${code}. Đang tự động gửi...`);
    setTimeout(() => {
      try {
        bot.chat(`/confirm ${code}`);
      } catch (err) {
        console.error('[Auto-Captcha] Gửi confirm thất bại:', err.message);
      }
    }, 1000);
    return;
  }

  // 4. Dạng: mã xác minh trơn (chỉ là chuỗi số/chữ 4-6 ký tự có nhãn mô tả)
  const codeOnlyRegex = /(?:mã xác minh|mã captcha|mã xác thực|verification code|captcha code)(?:\s+của bạn)?(?:\s+là)?[\s:]+([a-zA-Z0-9]{4,6})\b/i;
  match = messageStr.match(codeOnlyRegex);
  if (match && match[1]) {
    const code = match[1];
    console.log(`[Auto-Captcha] Phát hiện mã xác minh trơn: ${code}. Đang tự động gửi...`);
    setTimeout(() => {
      try {
        bot.chat(code);
      } catch (err) {
        console.error('[Auto-Captcha] Gửi mã xác minh thất bại:', err.message);
      }
    }, 1000);
    return;
  }
}

// Hàm tự động phát hiện và thực hiện Đăng ký / Đăng nhập (AuthMe) bảo mật
function checkAndHandleAuth(messageStr, bot, password) {
  if (!messageStr || !bot || !password) return;

  const cleanMsg = messageStr.toLowerCase();
  
  // Tránh bị người chơi dụ dỗ bằng cách bỏ qua tin nhắn có dạng chat thường
  const playerChatRegex = /^[\[\(]?[a-zA-Z0-9_]{3,16}[\]\)]?\s*[:>→-]/; 
  if (playerChatRegex.test(messageStr)) {
    return;
  }

  // 1. Kiểm tra yêu cầu Đăng ký (Register)
  if (cleanMsg.includes('/register') || cleanMsg.includes('/reg') || 
      (cleanMsg.includes('đăng ký') && (cleanMsg.includes('mật khẩu') || cleanMsg.includes('mat khau')))) {
    console.log(`[Auto-Auth] Phát hiện yêu cầu đăng ký tài khoản. Đang gửi /register...`);
    setTimeout(() => {
      try {
        bot.chat(`/register ${password} ${password}`);
      } catch (err) {
        console.error('[Auto-Auth] Gửi lệnh register thất bại:', err.message);
      }
    }, 1500);
    return;
  }

  // 2. Kiểm tra yêu cầu Đăng nhập (Login)
  if (cleanMsg.includes('/login') || cleanMsg.includes('/l ') || cleanMsg.includes('đăng nhập') || cleanMsg.includes('dang nhap')) {
    console.log(`[Auto-Auth] Phát hiện yêu cầu đăng nhập. Đang gửi /login...`);
    setTimeout(() => {
      try {
        bot.chat(`/login ${password}`);
      } catch (err) {
        console.error('[Auto-Auth] Gửi lệnh login thất bại:', err.message);
      }
    }, 1500);
    return;
  }
}

// Bảng màu cơ bản của Bản đồ Minecraft (Minecraft Map Colors)
const baseColors = [
  [0, 0, 0],         // 0: transparent
  [127, 178, 56],    // 1: grass
  [247, 233, 163],   // 2: sand
  [199, 199, 199],   // 3: wool
  [255, 0, 0],       // 4: fire
  [160, 160, 255],   // 5: ice
  [167, 167, 167],   // 6: iron
  [0, 124, 0],       // 7: foliage
  [255, 255, 255],   // 8: snow
  [164, 168, 184],   // 9: clay
  [151, 109, 77],    // 10: dirt
  [112, 112, 112],   // 11: stone
  [64, 64, 255],     // 12: water
  [143, 119, 72],    // 13: wood
  [255, 252, 245],   // 14: quartz
  [216, 127, 51],    // 15: orange
  [178, 76, 216],    // 16: magenta
  [102, 153, 216],   // 17: light blue
  [229, 229, 51],    // 18: yellow
  [127, 204, 25],    // 19: lime
  [242, 127, 165],   // 20: pink
  [76, 76, 76],      // 21: gray
  [153, 153, 153],   // 22: light gray
  [76, 127, 153],    // 23: cyan
  [127, 63, 178],    // 24: purple
  [51, 76, 178],     // 25: blue
  [102, 76, 51],      // 26: brown
  [102, 127, 51],    // 27: green
  [153, 51, 51],     // 28: red
  [25, 25, 25],      // 29: black
  [250, 238, 77],    // 30: gold
  [92, 219, 219],    // 31: diamond
  [74, 128, 255],    // 32: lapis
  [0, 217, 58],      // 33: emerald
  [129, 86, 49],     // 34: podzol
  [112, 2, 0],       // 35: nether
  [209, 177, 161],   // 36: white terracotta
  [159, 82, 36],     // 37: orange terracotta
  [149, 87, 108],    // 38: magenta terracotta
  [112, 108, 138],   // 39: light blue terracotta
  [186, 133, 36],    // 40: yellow terracotta
  [103, 117, 53],    // 41: lime terracotta
  [160, 77, 78],     // 42: pink terracotta
  [57, 41, 35],      // 43: gray terracotta
  [135, 107, 98],    // 44: light gray terracotta
  [87, 92, 92],      // 45: cyan terracotta
  [122, 73, 88],     // 46: purple terracotta
  [76, 62, 92],      // 47: blue terracotta
  [76, 50, 35],      // 48: brown terracotta
  [76, 82, 42],      // 49: green terracotta
  [142, 60, 46],     // 50: red terracotta
  [37, 22, 16],      // 51: black terracotta
  [189, 48, 49],     // 52: crimson nylon
  [148, 63, 97],     // 53: crimson stem
  [92, 25, 29],      // 54: crimson hyphae
  [22, 126, 134],    // 55: warped nylium
  [58, 142, 140],    // 56: warped stem
  [86, 44, 62],      // 57: warped hyphae
  [22, 82, 101]      // 58: warped wart block
];

function getColorRgb(colorId) {
  const baseId = Math.floor(colorId / 4);
  const shadeId = colorId % 4;
  
  let baseColor = baseColors[baseId];
  if (!baseColor) {
    baseColor = [128, 128, 128]; // Mặc định là màu xám nếu vượt dải màu
  }
  
  let multiplier = 1.0;
  if (shadeId === 0) multiplier = 180 / 255;
  else if (shadeId === 1) multiplier = 220 / 255;
  else if (shadeId === 3) multiplier = 135 / 255;
  
  return [
    Math.round(baseColor[0] * multiplier),
    Math.round(baseColor[1] * multiplier),
    Math.round(baseColor[2] * multiplier)
  ];
}

function generateBmpBuffer(colors) {
  const fileHeaderSize = 14;
  const infoHeaderSize = 40;
  const pixelDataSize = 128 * 128 * 3;
  const fileSize = fileHeaderSize + infoHeaderSize + pixelDataSize;
  
  const buffer = Buffer.alloc(fileSize);
  
  // --- File Header ---
  buffer.write('BM', 0, 2); // Ký hiệu BMP
  buffer.writeUInt32LE(fileSize, 2); // Kích thước file
  buffer.writeUInt32LE(0, 6); // Reserved
  buffer.writeUInt32LE(fileHeaderSize + infoHeaderSize, 10); // Offset dữ liệu ảnh
  
  // --- Info Header ---
  buffer.writeUInt32LE(infoHeaderSize, 14); // Kích thước Info Header
  buffer.writeInt32LE(128, 18); // Chiều rộng
  buffer.writeInt32LE(-128, 22); // Chiều cao (Âm để kết xuất ảnh từ trên xuống dưới)
  buffer.writeUInt16LE(1, 26); // Số lớp màu (Planes)
  buffer.writeUInt16LE(24, 28); // Bit mỗi Pixel (24-bit BGR)
  buffer.writeUInt32LE(0, 30); // Phương pháp nén (0 = Không nén)
  buffer.writeUInt32LE(pixelDataSize, 34); // Kích thước dữ liệu điểm ảnh
  buffer.writeInt32LE(0, 38); // Độ phân giải ngang
  buffer.writeInt32LE(0, 42); // Độ phân giải dọc
  buffer.writeUInt32LE(0, 46); // Số màu trong bảng màu
  buffer.writeUInt32LE(0, 50); // Số màu quan trọng
  
  // --- Pixel Data (BGR Order) ---
  let offset = fileHeaderSize + infoHeaderSize;
  for (let i = 0; i < colors.length; i++) {
    const colorId = colors[i];
    const rgb = getColorRgb(colorId);
    
    // Lưu thứ tự BGR
    buffer.writeUInt8(rgb[2], offset);     // Blue
    buffer.writeUInt8(rgb[1], offset + 1); // Green
    buffer.writeUInt8(rgb[0], offset + 2); // Red
    offset += 3;
  }
  
  return buffer;
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
// Lưu trữ bộ quét captcha định kỳ (bản đồ, biển hiệu, hologram)
const scanIntervals = {};

io.on('connection', (socket) => {
  console.log(`[Socket] Client kết nối mới: ${socket.id}`);

  // Gửi trạng thái ban đầu của bot cho client mới kết nối
  socket.emit('bot-status', { status: 'offline', message: 'Chưa kết nối bot' });

  // Hàm khởi tạo và quản lý kết nối bot Minecraft
  function connectBot(config) {
    const { host, port, username, password, version, auth, autoReconnect } = config;
    const socketId = socket.id;

    // Lưu các tên thực thể đã log để tránh gửi trùng lặp
    const loggedEntityNames = {};
    let loginTimeoutTimer = null;
    let hasLoggedIn = false;

    function handleMapPacket(packet) {
      if (!packet) return;
      const id = packet.mapId !== undefined ? packet.mapId : packet.map_id;
      const width = packet.columns;
      const height = packet.rows;
      const colors = packet.data;
      
      console.log(`[Bot] Nhận gói dữ liệu bản đồ qua packet. ID: ${id}, Kích thước: ${width}x${height}`);
      
      if (width === 128 && height === 128 && colors) {
        try {
          const bmpBuffer = generateBmpBuffer(colors);
          const base64Image = 'data:image/bmp;base64,' + bmpBuffer.toString('base64');
          console.log(`[Bot] Đã tạo ảnh bản đồ thành công (Base64). Đang gửi lên frontend...`);
          socket.emit('bot-map', {
            id: id,
            image: base64Image
          });
        } catch (err) {
          console.error('[Bot] Lỗi khi tạo ảnh bản đồ từ packet:', err.message);
        }
      }
    }

    function handleEntityText(entity) {
      // Bỏ qua thực thể của chính bot
      if (bot.entity && entity.id === bot.entity.id) return;

      const name = getEntityName(entity);
      if (!name) return;
      
      const cleanName = name.trim();
      if (!cleanName) return;
      
      const entityId = entity.id;
      if (loggedEntityNames[entityId] === cleanName) return;
      loggedEntityNames[entityId] = cleanName;
      
      console.log(`[Bot] Phát hiện thực thể có tên [${entity.name || entity.type} (ID: ${entityId})]: ${cleanName}`);
      socket.emit('bot-chat', {
        sender: 'System',
        message: `[Thực thể - ${entity.name || entity.type}] ${cleanName}`,
        time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
      });
      
      checkAndSolveCaptcha(cleanName, bot);
      checkAndHandleAuth(cleanName, bot, password);
    }

    console.log(`[Bot] Khởi tạo kết nối cho ${socketId} -> ${host}:${port || 25565} [Auth: ${auth || 'offline'}, Version: ${version}, AutoReconnect: ${autoReconnect}]`);

    // Dừng bot cũ nếu có
    if (activeBots[socketId]) {
      try {
        activeBots[socketId].end();
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

    // Xóa bộ quét định kỳ cũ nếu có
    if (scanIntervals[socketId]) {
      clearInterval(scanIntervals[socketId]);
      delete scanIntervals[socketId];
    }

    socket.emit('bot-status', { status: 'connecting', message: 'Đang kết nối tới server Minecraft...' });

    // Khởi tạo Mineflayer Bot Options
    const botOptions = {
      host: host,
      port: parseInt(port) || 25565,
      username: username || `Bot_${Math.floor(Math.random() * 1000)}`,
      auth: auth === 'microsoft' ? 'microsoft' : 'offline',
      version: version && version !== 'auto' ? version : false,
      hideErrors: true,
      onMsaCode: (data) => {
        console.log(`[Bot] Cần xác thực Microsoft. Mã: ${data.user_code}`);
        socket.emit('bot-status', { 
          status: 'connecting', 
          message: `Xác thực Microsoft: Truy cập ${data.verification_uri} và nhập mã: ${data.user_code}` 
        });
      }
    };

    let bot;
    try {
      bot = mineflayer.createBot(botOptions);
      bot.entity = { id: -1 }; // Khởi tạo để tránh crash lỗi entity_status khi chưa login
      activeBots[socketId] = bot;
      botConfigs[socketId] = config; // Lưu cấu hình lại để reconect

      // Cấu hình timeout kết nối nếu sau 25 giây chưa đăng nhập thành công
      loginTimeoutTimer = setTimeout(() => {
        console.log(`[Bot] Kết nối tới ${host}:${port} quá thời gian chờ (25s). Tiến hành đóng kết nối.`);
        try {
          bot.end();
        } catch (e) {
          console.error('[Bot] Lỗi khi đóng bot do timeout:', e.message);
        }
        handleBotDisconnect('Lỗi: Kết nối quá thời gian chờ (Timeout 25s)');
      }, 25000);

    } catch (error) {
      console.error('[Bot] Khởi tạo mineflayer thất bại:', error.message);
      socket.emit('bot-status', { status: 'error', message: `Không thể tạo Bot: ${error.message}` });
      return;
    }

    function handleBotDisconnect(reasonText, isError = false) {
      let finalReasonText = reasonText;
      if (!hasLoggedIn) {
        if (reasonText.includes('ECONNREFUSED')) {
          finalReasonText = 'Lỗi: Server đang Offline hoặc Cổng (Port) không chính xác';
        } else if (reasonText.includes('ETIMEDOUT')) {
          finalReasonText = 'Lỗi: Không thể kết nối tới Server (Server Offline hoặc bị Tường lửa chặn)';
        } else if (reasonText.includes('ECONNRESET') || reasonText.includes('socketClosed')) {
          finalReasonText = 'Lỗi: Server từ chối kết nối ngay lập tức (Có thể do sai phiên bản, sai loại Auth hoặc bị chặn IP/Anti-bot)';
        }
      }

      console.log(`[Bot] handleBotDisconnect [${socketId}] - Lý do: ${finalReasonText}. Trạng thái timer: ${reconnectTimers[socketId] ? 'Đang có' : 'Chưa có'}`);
      if (loginTimeoutTimer) {
        clearTimeout(loginTimeoutTimer);
        loginTimeoutTimer = null;
      }

      // Xóa bộ quét định kỳ captcha
      if (scanIntervals[socketId]) {
        clearInterval(scanIntervals[socketId]);
        delete scanIntervals[socketId];
      }

      // Nếu socket client đã ngắt kết nối khỏi server backend, giải phóng tài nguyên ngay
      if (!socket.connected) {
        delete activeBots[socketId];
        delete botConfigs[socketId];
        return;
      }

      delete activeBots[socketId];

      // Nếu người dùng bật Auto Reconnect, thực hiện đếm ngược kết nối lại
      if (autoReconnect) {
        // Nếu bị Timeout 25s, không tự động kết nối lại để tránh spam làm tăng thời gian khóa của proxy
        if (finalReasonText.includes('Timeout 25s')) {
          console.log(`[Bot] Ngắt kết nối do Timeout 25s. Tạm dừng tự động kết nối lại để tránh bị khóa IP/Tên.`);
          socket.emit('bot-status', { 
            status: 'error', 
            message: `${finalReasonText}. Đã tắt Auto-Reconnect. Vui lòng đổi tên Bot hoặc đợi 1 phút.` 
          });
          return;
        }

        if (!reconnectTimers[socketId]) {
          // Xác định thời gian chờ kết nối lại (mặc định 10s, nếu bị kick để rejoin thì chờ 25s để tránh rate limit của Bungee/TCPShield)
          const isRejoinKick = finalReasonText.toLowerCase().includes('rejoin') || finalReasonText.toLowerCase().includes('solved');
          const delayMs = isRejoinKick ? 25000 : 10000;
          const delaySec = delayMs / 1000;

          console.log(`[Bot] Bot của ${socketId} bị ngắt kết nối. Đang tự động kết nối lại sau ${delaySec} giây...`);
          socket.emit('bot-status', { 
            status: 'connecting', 
            message: `${finalReasonText}. Tự động kết nối lại sau ${delaySec}s...` 
          });

          reconnectTimers[socketId] = setTimeout(() => {
            delete reconnectTimers[socketId];
            if (socket.connected) {
              connectBot(config);
            }
          }, delayMs);
        }
      } else {
        socket.emit('bot-status', { 
          status: isError ? 'error' : 'offline', 
          message: finalReasonText 
        });
      }
    }

    // --- CÁC SỰ KIỆN CỦA BOT ---

    // 0. Khi bot đã đăng nhập thành công vào server (chưa spawn)
    bot.on('login', () => {
      hasLoggedIn = true;
      if (loginTimeoutTimer) {
        clearTimeout(loginTimeoutTimer);
        loginTimeoutTimer = null;
      }

      console.log(`[Bot] Bot [${bot.username}] đã đăng nhập vào server (đang chờ spawn).`);
      socket.emit('bot-status', { 
        status: 'online', 
        message: `Đã kết nối thành công với tên: ${bot.username} (Đang chờ tải thế giới...)` 
      });

      // Theo dõi thay đổi hòm đồ để phát hiện và tự động cầm bản đồ captcha ngay khi nhận được
      if (bot.inventory) {
        bot.inventory.on('updateSlot', (slot, oldItem, newItem) => {
          if (newItem) {
            console.log(`[Bot] Vật phẩm mới xuất hiện (Slot ${slot}): ${newItem.name} x ${newItem.count}`);
            
            socket.emit('bot-chat', {
              sender: 'System',
              message: `[Hòm đồ - Nhận] Slot ${slot}: ${newItem.displayName || newItem.name} (Số lượng: ${newItem.count})`,
              time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
            });

            if (newItem.name && (newItem.name.includes('map') || newItem.name.includes('filled_map'))) {
              console.log(`[Bot] Phát hiện bản đồ mới trong Slot ${slot}. Đang tự động cầm lên tay...`);
              bot.equip(newItem, 'hand')
                .then(() => {
                  console.log('[Bot] Đã tự động trang bị bản đồ lên tay.');
                  socket.emit('bot-chat', {
                    sender: 'System',
                    message: `[Hòm đồ - Cầm tay] Đã tự động trang bị Bản đồ lên tay chính.`,
                    time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
                  });
                })
                .catch(err => {
                  console.warn('[Bot] Lỗi khi tự động cầm bản đồ:', err.message);
                });
            }
          }
        });
      }

      // Đăng ký lắng nghe packet map_data và map để nhận diện dữ liệu ảnh bản đồ
      if (bot._client) {
        bot._client.on('map_data', handleMapPacket);
        bot._client.on('map', handleMapPacket);
      }

      // Bắt đầu quét định kỳ để tìm biển báo, bản đồ và hologram ngay khi đăng nhập
      if (scanIntervals[socketId]) {
        clearInterval(scanIntervals[socketId]);
      }
      
      scanIntervals[socketId] = setInterval(() => {
        if (!activeBots[socketId]) return;
        
        // 1. Quét tìm biển hiệu (Sign) xung quanh
        try {
          const registry = bot.registry || (bot.version ? require('minecraft-data')(bot.version) : require('minecraft-data')('1.21.1'));
          if (registry) {
            const signIds = Object.values(registry.blocksByName)
              .filter(b => b.name && b.name.includes('sign'))
              .map(b => b.id);
              
            const signBlocks = bot.findBlocks({
              matching: signIds,
              maxDistance: 16,
              count: 10
            });
            
            for (const pos of signBlocks) {
              const block = bot.blockAt(pos);
              if (block && typeof block.getSignText === 'function') {
                const lines = block.getSignText();
                const text = lines.map(l => l.trim()).filter(l => l).join(' | ');
                if (text) {
                  const key = `sign_${pos.x}_${pos.y}_${pos.z}`;
                  if (loggedEntityNames[key] !== text) {
                    loggedEntityNames[key] = text;
                    console.log(`[Bot] Phát hiện biển báo tại ${pos}: ${text}`);
                    socket.emit('bot-chat', {
                      sender: 'System',
                      message: `[Biển báo] ${text}`,
                      time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
                    });
                    checkAndSolveCaptcha(text, bot);
                    checkAndHandleAuth(text, bot, password);
                  }
                }
              }
            }
          }
        } catch (err) {
          // Bỏ qua lỗi quét
        }

        // 2. Tự động tìm và cầm bản đồ (Map / Filled Map) trên tay
        try {
          if (bot.inventory) {
            const item = bot.inventory.items().find(i => i && i.name && (i.name.includes('map') || i.name.includes('filled_map')));
            if (item) {
              const heldItem = bot.heldItem;
              if (!heldItem || heldItem.type !== item.type) {
                console.log(`[Bot] Tìm thấy bản đồ trong hòm đồ: ${item.name}. Tiến hành trang bị lên tay...`);
                bot.equip(item, 'hand')
                  .catch(err => {
                    // Chưa sẵn sàng
                  });
              }
            }
          }
        } catch (err) {
          // Bỏ qua lỗi hòm đồ
        }

        // 3. Quét kiểm tra các thực thể Hologram hiện có xung quanh
        try {
          if (bot.entities) {
            Object.values(bot.entities).forEach(entity => {
              if (entity) {
                handleEntityText(entity);
              }
            });
          }
        } catch (err) {
          // Bỏ qua lỗi thực thể
        }
      }, 1500);
    });

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

      // Quét tìm biển hiệu (Sign) xung quanh khi spawn để tìm captcha
      setTimeout(() => {
        if (!activeBots[socket.id]) return;
        try {
          const registry = bot.registry || (bot.version ? require('minecraft-data')(bot.version) : require('minecraft-data')('1.21.1'));
          if (registry) {
            const signIds = Object.values(registry.blocksByName)
              .filter(b => b.name && b.name.includes('sign'))
              .map(b => b.id);
            
          const signBlocks = bot.findBlocks({
            matching: signIds,
            maxDistance: 16,
            count: 10
          });
          
          for (const pos of signBlocks) {
            const block = bot.blockAt(pos);
            if (block && typeof block.getSignText === 'function') {
              const lines = block.getSignText();
              const text = lines.map(l => l.trim()).filter(l => l).join(' | ');
              if (text) {
                console.log(`[Bot] Phát hiện biển báo khi spawn tại ${pos}: ${text}`);
                socket.emit('bot-chat', {
                  sender: 'System',
                  message: `[Biển báo] ${text}`,
                  time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
                });
                checkAndSolveCaptcha(text, bot);
                checkAndHandleAuth(text, bot, password);
              }
            }
          }
        }
      } catch (err) {
        console.error('[Bot] Lỗi khi quét tìm biển báo:', err.message);
      }
      }, 2000);
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
      
      // Tự động kiểm tra và giải captcha nếu có
      checkAndSolveCaptcha(messageStr, bot);
      checkAndHandleAuth(messageStr, bot, password);

      const isNormalChat = messageStr.includes('<') && messageStr.includes('>');
      if (!isNormalChat) {
        socket.emit('bot-chat', {
          sender: 'System',
          message: messageStr,
          time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
        });
      }
    });



    // 5.6. Lắng nghe tiêu đề (Title) để hiển thị Captcha hoặc thông tin từ server
    bot.on('title', (titleText, type) => {
      if (!titleText) return;
      let text = titleText;
      if (typeof text === 'object') {
        text = extractAllStrings(text);
      }
      if (!text.trim()) return;
      
      console.log(`[Bot] Nhận tiêu đề (${type}): ${text}`);
      socket.emit('bot-chat', {
        sender: 'System',
        message: `[Tiêu đề - ${type}] ${text}`,
        time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
      });
      
      // Kiểm tra xem tiêu đề có chứa captcha không
      checkAndSolveCaptcha(text, bot);
      checkAndHandleAuth(text, bot, password);
    });

    // 5.7. Lắng nghe ActionBar (thông tin trên thanh công cụ)
    bot.on('actionBar', (message) => {
      if (!message) return;
      let text = message;
      if (typeof text === 'object') {
        if (typeof text.toString === 'function') text = text.toString();
        else text = extractAllStrings(text);
      }
      if (!text.trim()) return;
      
      console.log(`[Bot] Nhận ActionBar: ${text}`);
      socket.emit('bot-chat', {
        sender: 'System',
        message: `[Action Bar] ${text}`,
        time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
      });
      
      // Kiểm tra xem ActionBar có chứa captcha không
      checkAndSolveCaptcha(text, bot);
      checkAndHandleAuth(text, bot, password);
    });

    // 5.8. Lắng nghe BossBar (thanh Boss trên cùng)
    bot.on('bossBarCreated', (bossBar) => {
      if (!bossBar || !bossBar.title) return;
      let text = bossBar.title;
      if (typeof text === 'object') {
        if (typeof text.toString === 'function') text = text.toString();
        else text = extractAllStrings(text);
      }
      if (!text.trim()) return;
      
      console.log(`[Bot] Nhận BossBar mới: ${text}`);
      socket.emit('bot-chat', {
        sender: 'System',
        message: `[Boss Bar] ${text}`,
        time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
      });
      
      // Kiểm tra xem BossBar có chứa captcha không
      checkAndSolveCaptcha(text, bot);
      checkAndHandleAuth(text, bot, password);
    });

    bot.on('bossBarUpdated', (bossBar) => {
      if (!bossBar || !bossBar.title) return;
      let text = bossBar.title;
      if (typeof text === 'object') {
        if (typeof text.toString === 'function') text = text.toString();
        else text = extractAllStrings(text);
      }
      if (!text.trim()) return;
      
      console.log(`[Bot] Nhận cập nhật BossBar: ${text}`);
      socket.emit('bot-chat', {
        sender: 'System',
        message: `[Boss Bar Cập nhật] ${text}`,
        time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
      });
      
      // Kiểm tra xem BossBar có chứa captcha không
      checkAndSolveCaptcha(text, bot);
      checkAndHandleAuth(text, bot, password);
    });

    // 5.9. Lắng nghe và bóc tách chữ trên các thực thể Hologram (ArmorStand, TextDisplay)

    bot.on('entitySpawn', (entity) => {
      handleEntityText(entity);
    });

    bot.on('entityUpdate', (entity) => {
      handleEntityText(entity);
    });

    // 5.10. Lắng nghe cập nhật block để xem có biển hiệu (Sign) mới được sửa đổi/xuất hiện không
    bot.on('blockUpdate', (oldBlock, newBlock) => {
      if (newBlock && newBlock.name && newBlock.name.includes('sign')) {
        setTimeout(() => {
          if (!activeBots[socket.id]) return;
          const block = bot.blockAt(newBlock.position);
          if (block && typeof block.getSignText === 'function') {
            const lines = block.getSignText();
            const text = lines.map(line => line.trim()).filter(line => line).join(' | ');
            if (text) {
              console.log(`[Bot] Phát hiện biển báo cập nhật tại ${newBlock.position}: ${text}`);
              socket.emit('bot-chat', {
                sender: 'System',
                message: `[Biển báo] ${text}`,
                time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
              });
              checkAndSolveCaptcha(text, bot);
              checkAndHandleAuth(text, bot, password);
            }
          }
        }, 500);
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
        bot.end();
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
        bot.end();
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
