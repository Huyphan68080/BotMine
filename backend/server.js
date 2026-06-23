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
// =================================================================
// SYSTEM LOGGING HOOKS (Injected to redirect logs to /api/logs API)
// =================================================================
try {
  require('dotenv').config();
} catch (e) {
  // Bỏ qua nếu không có package dotenv (trên Render biến môi trường được inject trực tiếp)
}

const logsBuffer = [];
const MAX_LOGS = 100;
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

let discordQueue = [];
let discordFlushTimeout = null;

function sendToDiscordWebhook(vnTime, type, message) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const lowerMsg = message.toLowerCase();
  const shouldIgnore = [
    'bossbar',
    'phát hiện thực thể',
    'bản đồ',
    'viewer',
    'localtunnel',
    'socket client',
    'ping tự động',
    'xác thực microsoft'
  ].some(pattern => lowerMsg.includes(pattern));

  if (shouldIgnore) return;

  discordQueue.push(`[${vnTime.split(' ')[0]}] [${type}] ${message}`);

  if (!discordFlushTimeout) {
    discordFlushTimeout = setTimeout(flushDiscordQueue, 3000);
  }
}

function flushDiscordQueue() {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  discordFlushTimeout = null;

  if (discordQueue.length === 0 || !webhookUrl) return;

  const payloadText = discordQueue.join('\n');
  discordQueue = [];

  try {
    const https = require('https');
    const url = require('url');
    const parsedUrl = url.parse(webhookUrl);
    
    let content = payloadText;
    if (content.length > 1900) {
      content = content.substring(0, 1850) + '\n... (và các dòng log khác)';
    }

    const postData = JSON.stringify({ content: `\`\`\`text\n${content}\n\`\`\`` });

    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      res.resume();
    });

    req.on('error', (e) => {
      originalError('[Webhook Error] Lỗi gửi log tới Discord:', e.message);
    });

    req.write(postData);
    req.end();
  } catch (err) {
    originalError('[Webhook Error] Lỗi xử lý Webhook:', err.message);
  }
}

function addLogToBuffer(type, args) {
  const message = args.map(arg => {
    if (typeof arg === 'object') {
      try { return JSON.stringify(arg); } catch (e) { return String(arg); }
    }
    return String(arg);
  }).join(' ');
  const vnTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  logsBuffer.unshift({ timestamp: vnTime, type: type, message: message });
  if (logsBuffer.length > MAX_LOGS) {
    logsBuffer.pop();
  }

  // Tự động đẩy log lên Discord Webhook
  sendToDiscordWebhook(vnTime, type, message);
}

console.log = function(...args) {
  originalLog.apply(console, args);
  addLogToBuffer('LOG', args);
};
console.error = function(...args) {
  originalError.apply(console, args);
  addLogToBuffer('ERROR', args);
};
console.warn = function(...args) {
  originalWarn.apply(console, args);
  addLogToBuffer('WARN', args);
};

const originalExpress = require('express');
const express = function() {
  const app = originalExpress();
  
  // Enable CORS configuration to allow cross-origin requests for logs endpoint
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

  // Expose JSON logs endpoint
  app.get('/api/logs', (req, res) => {
    res.json(logsBuffer);
  });

  return app;
};
Object.assign(express, originalExpress);
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mineflayer = require('mineflayer');

const prismarineRegistry = require('prismarine-registry');
const prismarineChat = require('prismarine-chat');


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

// Hàm chuyển đổi Chat Component sang chuỗi văn bản hoàn chỉnh sử dụng thư viện prismarine-chat chuẩn
function chatToString(component, bot) {
  if (component === null || component === undefined) return '';
  
  if (typeof component === 'object' && typeof component.toString === 'function') {
    const str = component.toString();
    if (str && str !== '[object Object]') {
      return str;
    }
  }

  let parsed = component;
  if (typeof component === 'string') {
    try {
      parsed = JSON.parse(component);
    } catch (e) {
      return component;
    }
  }

  try {
    const registry = (bot && bot.registry) || prismarineRegistry('1.21.1');
    const ChatMessage = prismarineChat(registry);
    const msg = new ChatMessage(parsed);
    const str = msg.toString();
    if (str) {
      if (str === 'disconnect.genericReason' || str === 'disconnect.quitting') {
        return 'Mất kết nối đột ngột hoặc Server chủ động đóng kết nối';
      }
      return str;
    }
  } catch (err) {
    // Fallback
  }

  return extractAllStrings(parsed);
}

function parseKickReason(reason, bot) {
  if (!reason) return 'Bị kick không rõ lý do';
  return chatToString(reason, bot);
}

function getFormattedItemName(item, bot) {
  if (!item) return '';
  const extractText = (val) => {
    if (!val) return '';
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        return chatToString(parsed, bot);
      } catch (e) {
        return val;
      }
    }
    return chatToString(val, bot);
  };

  if (item.customName) {
    const str = extractText(item.customName);
    if (str) return String(str);
  }
  if (item.nbt && item.nbt.value && item.nbt.value.display && item.nbt.value.display.value && item.nbt.value.display.value.Name) {
    const str = extractText(item.nbt.value.display.value.Name.value);
    if (str) return String(str);
  }
  return String(item.displayName || item.name || '');
}


function getEntityName(entity, bot) {
  if (!entity) return null;
  let name = null;
  if (typeof entity.getCustomName === 'function') {
    const cn = entity.getCustomName();
    if (cn) name = cn;
  }
  if (!name && entity.customName) name = entity.customName;
  if (!name && entity.displayName) name = entity.displayName;
  
  if (!name) return null;
  return chatToString(name, bot);
}

function getWeaponScore(item) {
  if (!item || !item.name) return 0;
  const name = item.name;
  let score = 0;
  if (name.includes('netherite_sword')) score = 120;
  else if (name.includes('diamond_sword')) score = 100;
  else if (name.includes('iron_sword')) score = 80;
  else if (name.includes('stone_sword')) score = 60;
  else if (name.includes('golden_sword')) score = 40;
  else if (name.includes('wooden_sword')) score = 20;
  else if (name.includes('netherite_axe')) score = 110;
  else if (name.includes('diamond_axe')) score = 95;
  else if (name.includes('iron_axe')) score = 75;
  else if (name.includes('stone_axe')) score = 55;
  else if (name.includes('golden_axe')) score = 35;
  else if (name.includes('wooden_axe')) score = 15;
  return score;
}

async function eatOffhand(bot) {
  if (bot.isEating) return;
  
  try {
    const offhandDestSlot = typeof bot.getEquipmentDestSlot === 'function' ? bot.getEquipmentDestSlot('off-hand') : 45;
    const offhandItem = bot.inventory.slots[offhandDestSlot];
    if (!offhandItem) return;
    
    const isGapple = offhandItem.name === 'golden_apple' || offhandItem.name === 'enchanted_golden_apple';
    const foodNames = [
      'golden_carrot', 'cooked_beef', 'cooked_porkchop', 'cooked_chicken',
      'cooked_mutton', 'cooked_salmon', 'cooked_cod', 'cooked_rabbit', 'bread', 'baked_potato', 'carrot', 'apple'
    ];
    const isFood = foodNames.includes(offhandItem.name);
    
    if (!isGapple && !isFood) return;
    
    // Điều kiện ăn: táo vàng ăn khi máu < 20, thức ăn thường ăn khi đói < 19
    const needsEating = (isGapple && bot.health < 20) || (isFood && bot.food < 19);
    
    if (needsEating) {
      console.log(`[Auto-Eat Offhand] Bắt đầu ăn từ tay trái: ${offhandItem.name} (HP: ${bot.health}/20, Hunger: ${bot.food}/20)`);
      bot.isEating = true;
      
      // Bắt đầu giữ nút sử dụng tay phụ (tay trái)
      bot.activateItem(true); 
      
      // Đợi 1.8 giây để hoàn thành động tác ăn trong game
      await new Promise(resolve => setTimeout(resolve, 1800));
      
      // Thả nút sử dụng
      bot.deactivateItem();
      bot.isEating = false;
      console.log(`[Auto-Eat Offhand] Hoàn thành ăn: ${offhandItem.name}`);
    }
  } catch (err) {
    bot.isEating = false;
    console.warn('[Auto-Eat Offhand Error]:', err.message);
  }
}

// Kiểm tra xem block có tiếp giáp với không khí hoặc chất lỏng không (chỉ đào/quét quặng lộ thiên để bypass Anti-Xray/Anti-Freecam)
function isBlockExposed(bot, block) {
  if (!block || !block.position) return false;
  const { Vec3 } = require('vec3');
  const offsets = [
    new Vec3(1, 0, 0),
    new Vec3(-1, 0, 0),
    new Vec3(0, 1, 0),
    new Vec3(0, -1, 0),
    new Vec3(0, 0, 1),
    new Vec3(0, 0, -1)
  ];
  return offsets.some(offset => {
    const adj = bot.blockAt(block.position.plus(offset));
    if (!adj) return false;
    const name = adj.name.toLowerCase();
    
    // Các khối không rắn thường tiếp giáp với quặng lộ thiên trong hang động (bao gồm đuốc, địa y phát sáng, cỏ, tuyết...)
    const transparentKeywords = [
      'air', 'water', 'lava', 'lichen', 'torch', 'grass', 'flower', 
      'fern', 'dandelion', 'poppy', 'blue_orchid', 'allium', 'azure_bluet', 
      'tulip', 'oxeye_daisy', 'cornflower', 'lily', 'wither_rose', 'sunflower', 
      'lilac', 'rose_bush', 'peony', 'fire', 'snow', 'vine', 'rail', 'wire', 
      'lever', 'button', 'pressure_plate', 'redstone', 'carpet', 'sapling',
      'dripstone', 'spore_blossom', 'azalea', 'moss_carpet', 'moss_block',
      'amethyst', 'sign', 'banner', 'portal', 'web', 'ladder', 'lantern'
    ];
    
    return name === 'air' || name === 'cave_air' || name === 'void_air' || transparentKeywords.some(kw => name.includes(kw));
  });
}

// Phân tích kho đồ để phục vụ AI Sinh tồn
function checkInventoryForSurvival(bot) {
  const items = bot.inventory.items();
  const logNames = ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log', 'mangrove_log', 'cherry_log'];
  const plankNames = ['oak_planks', 'birch_planks', 'spruce_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks', 'mangrove_planks', 'cherry_planks'];
  
  const logs = items.filter(i => logNames.includes(i.name) || i.name.includes('_log'));
  const planks = items.filter(i => plankNames.includes(i.name) || i.name.includes('_planks'));
  const sticks = items.filter(i => i.name === 'stick');
  const craftingTables = items.filter(i => i.name === 'crafting_table');
  
  const pickaxes = items.filter(i => i.name.includes('_pickaxe'));
  const swords = items.filter(i => i.name.includes('_sword'));
  
  const totalLogs = logs.reduce((sum, i) => sum + i.count, 0);
  const totalPlanks = planks.reduce((sum, i) => sum + i.count, 0);
  const totalSticks = sticks.reduce((sum, i) => sum + i.count, 0);
  const totalCraftingTables = craftingTables.reduce((sum, i) => sum + i.count, 0);
  
  const stones = items.filter(i => i.name === 'cobblestone' || i.name === 'stone' || i.name === 'deepslate_cobblestone');
  const totalStones = stones.reduce((sum, i) => sum + i.count, 0);

  const hasStonePickaxe = pickaxes.some(i => i.name === 'stone_pickaxe' || i.name === 'iron_pickaxe' || i.name === 'diamond_pickaxe');
  const hasIronPickaxe = pickaxes.some(i => i.name === 'iron_pickaxe' || i.name === 'diamond_pickaxe');
  const hasWoodPickaxe = pickaxes.some(i => i.name === 'wooden_pickaxe');
  const hasPickaxe = pickaxes.length > 0;
  
  const hasStoneSword = swords.some(i => i.name === 'stone_sword' || i.name === 'iron_sword' || i.name === 'diamond_sword');
  const hasSword = swords.length > 0;

  return {
    totalLogs,
    totalPlanks,
    totalSticks,
    totalCraftingTables,
    totalStones,
    hasPickaxe,
    hasWoodPickaxe,
    hasStonePickaxe,
    hasIronPickaxe,
    hasSword,
    hasStoneSword
  };
}

// Hàm tự động đi nhặt các item rơi xung quanh
async function collectNearbyItems(bot) {
  const { goals } = require('mineflayer-pathfinder');
  let attempts = 0;
  while (attempts < 10) {
    const itemEntity = bot.nearestEntity(e => 
      e && 
      (e.name === 'item' || e.type === 'item' || e.type === 'object') && 
      e.position && 
      e.position.distanceTo(bot.entity.position) < 16
    );
    if (!itemEntity) break;
    
    console.log(`[Collect] Tìm thấy vật phẩm rơi ở cách ${bot.entity.position.distanceTo(itemEntity.position).toFixed(1)}m. Tiến hành đi nhặt...`);
    try {
      const targetGoal = goals.GoalNear 
        ? new goals.GoalNear(itemEntity.position.x, itemEntity.position.y, itemEntity.position.z, 1.0)
        : new goals.GoalBlock(itemEntity.position.x, itemEntity.position.y, itemEntity.position.z);
      
      await bot.pathfinder.goto(targetGoal);
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (e) {
      console.warn('[Collect] Lỗi khi di chuyển tới nhặt vật phẩm:', e.message);
      break;
    }
    attempts++;
  }
}

// Helper: Nhảy và đặt block dưới chân
async function scaffoldUp(bot, scaffoldItem) {
  const { Vec3 } = require('vec3');
  const blockBelow = bot.blockAt(bot.entity.position.offset(0, -1, 0));
  if (!blockBelow) return false;

  try {
    await bot.equip(scaffoldItem, 'hand');
    
    // Nhảy lên
    bot.setControlState('jump', true);
    await new Promise(resolve => setTimeout(resolve, 150));
    bot.setControlState('jump', false);

    // Nhìn xuống dưới chân và đặt block
    await bot.lookAt(blockBelow.position.offset(0.5, 1.0, 0.5));
    await bot.placeBlock(blockBelow, new Vec3(0, 1, 0));
    
    // Chờ 300ms để server đồng bộ vị trí đứng của bot trên block mới
    await new Promise(resolve => setTimeout(resolve, 300));
    return true;
  } catch (err) {
    console.error('[Scaffold Up Error]:', err.message);
    return false;
  }
}

// Helper: Chặt cột cây gỗ hoàn chỉnh, hỗ trợ kê chân leo lên nếu cây cao
async function chopTree(bot, startLogBlock) {
  const { goals } = require('mineflayer-pathfinder');
  const Vec3 = require('vec3');
  
  // 1. Đi tới gốc cây
  try {
    await bot.pathfinder.goto(new goals.GoalLookAtBlock(startLogBlock.position, bot.world));
  } catch (e) {
    console.warn('[Chop Tree] Không thể di chuyển tới gốc cây:', e.message);
    return false;
  }

  const startY = Math.floor(bot.entity.position.y);
  const treeX = startLogBlock.position.x;
  const treeZ = startLogBlock.position.z;

  // Quét tìm tất cả các block gỗ cùng cột X, Z từ gốc lên trên (tối đa cao hơn bot 8 block)
  let yOffset = 0;
  let logBlocks = [];
  while (yOffset < 10) {
    const checkPos = new Vec3(treeX, startLogBlock.position.y + yOffset, treeZ);
    const block = bot.blockAt(checkPos);
    if (block && block.name.includes('_log')) {
      logBlocks.push(block);
    } else if (yOffset > 0) {
      break;
    }
    yOffset++;
  }

  if (logBlocks.length === 0) return;

  bot.chat(`Bắt đầu chặt cây cao ${logBlocks.length} block...`);

  for (const log of logBlocks) {
    const currentLog = bot.blockAt(log.position);
    if (!currentLog || !currentLog.name.includes('_log')) continue;

    let botY = Math.floor(bot.entity.position.y);
    let logY = log.position.y;

    // Nếu block gỗ cao quá tầm tay
    while (logY - botY > 2) {
      const solidBlockNames = ['dirt', 'cobblestone', 'stone', 'planks', 'grass_block', 'andesite', 'diorite', 'granite'];
      const scaffoldItem = bot.inventory.items().find(i => solidBlockNames.some(name => i.name.includes(name)));
      
      if (!scaffoldItem) {
        bot.chat('Gỗ cao quá tầm tay mà tôi không có block nào để kê chân!');
        break;
      }

      bot.chat('Đặt block kê chân để leo lên chặt gỗ cao...');
      const success = await scaffoldUp(bot, scaffoldItem);
      if (!success) break;
      
      botY = Math.floor(bot.entity.position.y);
    }

    // Tiến hành chặt khúc gỗ
    try {
      await bot.lookAt(log.position.offset(0.5, 0.5, 0.5));
      const axeEquip = bot.inventory.items().find(i => i.name.includes('_axe'));
      if (axeEquip) await bot.equip(axeEquip, 'hand');
      await bot.dig(log);
      await new Promise(resolve => setTimeout(resolve, 200));
      await collectNearbyItems(bot);
    } catch (e) {
      console.warn(`[Chop Tree] Lỗi chặt khúc gỗ Y=${log.position.y}:`, e.message);
    }
  }

  // Thu dọn giàn giáo và đi xuống đất
  let currentY = Math.floor(bot.entity.position.y);
  if (currentY > startY) {
    bot.chat('Đang dọn block kê chân để đi xuống...');
  }
  while (currentY > startY) {
    const blockBelow = bot.blockAt(bot.entity.position.offset(0, -1, 0));
    if (blockBelow && blockBelow.name !== 'air' && blockBelow.name !== 'bedrock') {
      try {
        const shovelOrPick = bot.inventory.items().find(i => i.name.includes('_shovel') || i.name.includes('_pickaxe') || i.name.includes('_axe'));
        if (shovelOrPick) await bot.equip(shovelOrPick, 'hand');
        
        await bot.dig(blockBelow);
        await new Promise(resolve => setTimeout(resolve, 200));
        await collectNearbyItems(bot);
      } catch (e) {
        console.warn('[Chop Tree] Lỗi dọn block kê chân:', e.message);
        break;
      }
    } else {
      break;
    }
    currentY = Math.floor(bot.entity.position.y);
  }
  return true;
}

// Chế độ tự sinh tồn AI (AI Survival Loop v2)
function startSurvivalLoop(bot, socket) {
  if (bot.survivalInterval) clearInterval(bot.survivalInterval);
  
  bot.aiSurvivalEnabled = true;
  bot.isSurvivalBusy = false;

  // Đăng ký sự kiện chết để tự động hồi sinh
  if (!bot.aiSurvivalDeathHandler) {
    bot.aiSurvivalDeathHandler = () => {
      if (bot.aiSurvivalEnabled) {
        console.log('[AI Survival] Bot đã chết. Tự động hồi sinh sau 2 giây...');
        bot.isSurvivalBusy = false; // Reset trạng thái bận
        setTimeout(() => {
          try {
            if (bot && typeof bot.respawn === 'function') {
              bot.respawn();
              socket.emit('bot-chat', {
                sender: 'System',
                message: '💀 Bot đã chết và tự động hồi sinh.',
                time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
              });
            }
          } catch (e) {
            console.error('[AI Survival] Lỗi hồi sinh:', e.message);
          }
        }, 2000);
      }
    };
    bot.on('death', bot.aiSurvivalDeathHandler);
  }

  socket.emit('bot-chat', {
    sender: 'System',
    message: '❌ BẬT Chế độ AI Sinh Tồn v2 (Chặt cây, đào đá, tự chế tạo cúp/kiếm)',
    time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
  });

  bot.survivalInterval = setInterval(async () => {
    if (!bot.entity) return;
    if (bot.isSleeping) return;

    const now = Date.now();
    if (bot.isSurvivalBusy) {
      // Watchdog: Nếu bận quá 30 giây (do đào khối bảo vệ hoặc kẹt pathfinder), giải phóng bận để bot hoạt động tiếp
      if (bot.lastSurvivalTickTime && now - bot.lastSurvivalTickTime > 30000) {
        console.warn('[AI Survival] Watchdog: Phát hiện kẹt bận quá 30 giây! Tự động giải phóng...');
        bot.isSurvivalBusy = false;
      } else {
        return;
      }
    }
    bot.lastSurvivalTickTime = now;

    bot.isSurvivalBusy = true;
    bot.failedBlocks = bot.failedBlocks || [];
    if (bot.failedBlocks.length > 50) {
      bot.failedBlocks.shift();
    }
    try {
      const { goals } = require('mineflayer-pathfinder');
      const mcData = require('minecraft-data')(bot.version);
      const { Vec3 } = require('vec3');

      // 1. Kiểm tra máu để chạy trốn (Flee)
      if (bot.health !== undefined && bot.health < 8) {
        const hostile = bot.nearestEntity(e => 
          e && e.isValid !== false && e.id !== bot.entity.id &&
          (e.type === 'hostile' || e.type === 'mob') && 
          e.position && e.position.distanceTo(bot.entity.position) < 12
        );
        if (hostile) {
          socket.emit('bot-chat', {
            sender: 'System',
            message: `🏃 AI Sinh Tồn: Máu thấp (${bot.health}/20)! Đang chạy trốn khỏi ${hostile.name || hostile.type}...`,
            time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
          });
          
          const awayVec = bot.entity.position.clone().subtract(hostile.position).normalize().scale(15);
          const targetPos = bot.entity.position.clone().add(awayVec);
          
          if (bot.pathfinder) {
            try {
              bot.pathfinder.setGoal(new goals.GoalXZ(targetPos.x, targetPos.z), true);
              bot.setControlState('sprint', true);
              // Chạy trốn trong 4 giây
              await new Promise(resolve => setTimeout(resolve, 4000));
            } catch (e) {}
          }
          return;
        }
      }

      // 2. Đi ngủ nếu trời tối hoặc mưa bão (Auto Sleep)
      const timeOfDay = bot.time ? bot.time.timeOfDay : 0;
      const isNight = timeOfDay >= 12000 && timeOfDay <= 23000;
      const isRaining = bot.isRaining;

      if ((isNight || isRaining) && bot.pathfinder) {
        const bedBlock = bot.findBlock({
          matching: block => {
            if (!block) return false;
            const name = block.name.toLowerCase();
            return name.includes('bed') && !name.includes('bedrock');
          },
          maxDistance: 16
        });

        if (bedBlock) {
          const dist = bedBlock.position.distanceTo(bot.entity.position);
          if (dist > 2.5) {
            socket.emit('bot-chat', {
              sender: 'System',
              message: '🛌 AI Sinh Tồn: Trời tối/mưa. Đang di chuyển tìm giường ngủ...',
              time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
            });
            try {
              await bot.pathfinder.goto(new goals.GoalGetToBlock(bedBlock.position.x, bedBlock.position.y, bedBlock.position.z));
            } catch (e) {}
          } else {
            socket.emit('bot-chat', {
              sender: 'System',
              message: '🛌 AI Sinh Tồn: Đang leo lên giường ngủ...',
              time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
            });
            try {
              await bot.sleep(bedBlock);
            } catch (sleepErr) {
              console.warn('[AI Survival] Không ngủ được:', sleepErr.message);
            }
          }
          return;
        }
      }

      // Phân tích túi đồ để ra quyết định cày cuốc / chế tạo
      const inv = checkInventoryForSurvival(bot);

      // 3. Quy trình chế tạo công cụ & cày cuốc
      // Tính toán lượng ván gỗ ảo (virtual planks) và lượng cần thiết
      const virtualPlanks = inv.totalPlanks + (inv.totalLogs * 4);
      let planksNeeded = 0;
      if (inv.totalCraftingTables === 0) {
        planksNeeded += 4; // Cần bàn chế tạo
      }
      if (!inv.hasPickaxe) {
        planksNeeded += 3; // Cần cúp gỗ
        if (inv.totalSticks < 2) planksNeeded += 2; // Cần gậy (2 planks = 4 gậy)
      } else {
        // Đã có cúp, nhưng nếu thiếu gậy để làm cúp đá/kiếm đá
        if (inv.totalSticks < 4) planksNeeded += 2;
      }

      // Bước 3.1: Đi chặt gỗ nếu thiếu gỗ để chế tạo các công cụ cơ bản
      if (virtualPlanks < planksNeeded) {
        socket.emit('bot-chat', {
          sender: 'System',
          message: `🪓 AI Sinh Tồn: Thiếu gỗ (Hiện có: ${virtualPlanks}/${planksNeeded} ván gỗ)! Đi chặt cây...`,
          time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
        });

        const logBlock = bot.findBlock({
          matching: block => {
            if (!block || !block.name || !block.name.includes('_log')) return false;
            // Bỏ qua nếu block gỗ nằm trong danh sách đen tọa độ lỗi
            if (bot.failedBlocks && bot.failedBlocks.some(pos => pos.equals(block.position))) return false;
            return true;
          },
          maxDistance: 32
        });

        if (logBlock) {
          const success = await chopTree(bot, logBlock);
          if (!success) {
            console.warn('[AI Survival] Lỗi chặt cây, thêm vào blacklist:', logBlock.position);
            bot.failedBlocks.push(logBlock.position.clone());
          }
        } else {
          socket.emit('bot-chat', {
            sender: 'System',
            message: '🌳 AI Sinh Tồn: Không tìm thấy cây xung quanh, đang đi tìm kiếm...',
            time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
          });
          // Đi dạo để tìm kiếm cây
          const rx = (Math.random() - 0.5) * 40;
          const rz = (Math.random() - 0.5) * 40;
          const targetX = bot.entity.position.x + rx;
          const targetZ = bot.entity.position.z + rz;
          try {
            await bot.pathfinder.goto(new goals.GoalXZ(targetX, targetZ));
          } catch (e) {}
        }
        return;
      }

      // Bước 3.2: Chế tạo ván gỗ (Planks) và que gỗ (Sticks) từ gỗ khúc
      if (inv.totalLogs > 0 && inv.totalPlanks < 8) {
        socket.emit('bot-chat', {
          sender: 'System',
          message: '🪵 AI Sinh Tồn: Đang tự chế tạo Ván gỗ...',
          time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
        });
        const logItem = bot.inventory.items().find(i => i.name.includes('_log'));
        if (logItem) {
          const plankName = logItem.name.replace('_log', '_planks');
          const plankItem = mcData.itemsByName[plankName];
          if (plankItem) {
            const recipe = bot.recipesFor(plankItem.id, null, 1, null)[0];
            if (recipe) await bot.craft(recipe, 1, null);
          }
        }
        return;
      }

      if (inv.totalPlanks >= 2 && inv.totalSticks < 4) {
        socket.emit('bot-chat', {
          sender: 'System',
          message: '🪵 AI Sinh Tồn: Đang tự chế tạo Que gỗ...',
          time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
        });
        const stickItem = mcData.itemsByName['stick'];
        if (stickItem) {
          const recipe = bot.recipesFor(stickItem.id, null, 1, null)[0];
          if (recipe) await bot.craft(recipe, 1, null);
        }
        return;
      }

      // Bước 3.2.5: Đảm bảo có bàn chế tạo trong túi đồ trước khi chế tạo công cụ chính
      const needCraftingTable = (!inv.hasPickaxe) || (inv.hasWoodPickaxe && !inv.hasStonePickaxe && inv.totalStones >= 3);
      if (needCraftingTable && inv.totalCraftingTables === 0) {
        // Tìm bàn chế tạo đặt sẵn gần đó để đập thu hồi
        const nearTable = bot.findBlock({
          matching: block => block && block.name === 'crafting_table',
          maxDistance: 16
        });
        if (nearTable) {
          socket.emit('bot-chat', {
            sender: 'System',
            message: '🛠️ AI Sinh Tồn: Phát hiện Bàn chế tạo gần đó, tiến lại thu hồi...',
            time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
          });
          try {
            await bot.pathfinder.goto(new goals.GoalLookAtBlock(nearTable.position, bot.world));
            const tool = bot.inventory.items().find(i => i.name.includes('_axe') || i.name.includes('_pickaxe'));
            if (tool) await bot.equip(tool, 'hand');
            await bot.dig(nearTable);
            await new Promise(resolve => setTimeout(resolve, 200));
            await collectNearbyItems(bot);
          } catch (e) {
            console.warn('[AI Survival] Lỗi thu hồi bàn chế tạo:', e.message);
          }
          return;
        }

        // Tự chế tạo bàn chế tạo mới nếu đủ ván gỗ
        if (inv.totalPlanks >= 4) {
          socket.emit('bot-chat', {
            sender: 'System',
            message: '🛠️ AI Sinh Tồn: Tự chế tạo Bàn chế tạo mới...',
            time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
          });
          const tableItem = mcData.itemsByName['crafting_table'];
          if (tableItem) {
            const recipe = bot.recipesFor(tableItem.id, null, 1, null)[0];
            if (recipe) await bot.craft(recipe, 1, null);
          }
          return;
        }
      }

      // Bước 3.3: Nếu chưa có cúp gỗ, chế tạo cúp gỗ + kiếm gỗ
      if (!inv.hasPickaxe) {
        if (inv.totalCraftingTables > 0 && inv.totalPlanks >= 3 && inv.totalSticks >= 2) {
          // Bắt đầu quy trình đặt bàn chế tạo để làm Cúp gỗ
          socket.emit('bot-chat', {
            sender: 'System',
            message: '🛠️ AI Sinh Tồn: Đặt bàn chế tạo để chế tạo Cúp gỗ & Kiếm gỗ...',
            time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
          });
          await craftToolsWithTable(bot, socket, 'wooden_pickaxe');
          return;
        }
      }

      // Bước 3.4: Nếu đã có cúp gỗ nhưng chưa có cúp đá, đi đào đá
      if (inv.hasPickaxe && !inv.hasStonePickaxe && inv.totalStones < 8) {
        socket.emit('bot-chat', {
          sender: 'System',
          message: '🪨 AI Sinh Tồn: Đi đào Đá để nâng cấp công cụ...',
          time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
        });

        const stoneBlock = bot.findBlock({
          matching: block => {
            if (!block) return false;
            // Bỏ qua nếu block đá nằm trong danh sách đen tọa độ lỗi
            if (bot.failedBlocks && bot.failedBlocks.some(pos => pos.equals(block.position))) return false;
            
            const isStone = block.name === 'stone' || block.name === 'cobblestone' || block.name === 'deepslate' || 
                            block.name === 'andesite' || block.name === 'diorite' || block.name === 'granite';
            if (!isStone) return false;

            // Đá cũng cần lộ thiên để đảm bảo di chuyển an toàn và tự nhiên
            return isBlockExposed(bot, block);
          },
          maxDistance: 32
        });

        if (stoneBlock) {
          try {
            await bot.pathfinder.goto(new goals.GoalLookAtBlock(stoneBlock.position, bot.world));
            await bot.lookAt(stoneBlock.position.offset(0.5, 0.5, 0.5));
            const pick = bot.inventory.items().find(i => i.name.includes('_pickaxe'));
            if (pick) await bot.equip(pick, 'hand');
            await bot.dig(stoneBlock);
            await new Promise(resolve => setTimeout(resolve, 200));
            await collectNearbyItems(bot);
          } catch (e) {
            console.warn('[AI Survival] Lỗi đào đá, thêm vào blacklist:', stoneBlock.position, e.message);
            bot.failedBlocks.push(stoneBlock.position.clone());
          }
        } else {
          socket.emit('bot-chat', {
            sender: 'System',
            message: '🪨 AI Sinh Tồn: Không tìm thấy đá xung quanh, đang đi tìm kiếm...',
            time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
          });
          // Đi dạo để tìm kiếm đá
          const rx = (Math.random() - 0.5) * 40;
          const rz = (Math.random() - 0.5) * 40;
          const targetX = bot.entity.position.x + rx;
          const targetZ = bot.entity.position.z + rz;
          try {
            await bot.pathfinder.goto(new goals.GoalXZ(targetX, targetZ));
          } catch (e) {}
        }
        return;
      }

      // Bước 3.5: Nếu có đá và cúp gỗ, chế tạo cúp đá và kiếm đá để tự vệ khỏe hơn
      if (inv.hasWoodPickaxe && !inv.hasStonePickaxe && inv.totalStones >= 3 && inv.totalSticks >= 2) {
        socket.emit('bot-chat', {
          sender: 'System',
          message: '🛠️ AI Sinh Tồn: Đặt bàn chế tạo để nâng cấp lên Cúp đá & Kiếm đá...',
          time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
        });
        await craftToolsWithTable(bot, socket, 'stone_pickaxe');
        return;
      }

      // Bước 3.6: Nếu đã có cúp, đi tìm quặng gần đó trong bán kính 16 block để đào làm tài nguyên
      if (inv.hasPickaxe) {
        const targetOre = bot.miningTargetOre || 'all';
        const oreNamesVi = {
          'all': 'tất cả quặng',
          'coal_ore': 'quặng than',
          'iron_ore': 'quặng sắt',
          'copper_ore': 'quặng đồng',
          'gold_ore': 'quặng vàng',
          'redstone_ore': 'quặng đá đỏ',
          'lapis_ore': 'quặng lapis lazuli',
          'emerald_ore': 'quặng ngọc lục bảo',
          'quartz_ore': 'quặng thạch anh',
          'ancient_debris': 'mảnh cổ vật'
        };

        // Tin nhắn quét định kỳ (mỗi 15 giây gửi 1 lần để tránh spam)
        const now = Date.now();
        if (!bot.lastScanTime || now - bot.lastScanTime > 15000) {
          bot.lastScanTime = now;
          socket.emit('bot-chat', {
            sender: 'System',
            message: `🔍 AI Sinh Tồn: Đang quét địa hình bán kính 16 block tìm ${oreNamesVi[targetOre] || targetOre}...`,
            time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
          });
        }

        const oreBlock = bot.findBlock({
          matching: block => {
            if (!block || !block.name) return false;
            // Bỏ qua nếu block quặng nằm trong danh sách đen tọa độ lỗi
            if (bot.failedBlocks && bot.failedBlocks.some(pos => pos.equals(block.position))) return false;

            const name = block.name.toLowerCase();
            
            // Xác định xem block này có phải là quặng và khớp cấu hình người dùng hay không
            let matchesTarget = false;
            if (targetOre === 'all') {
              matchesTarget = name.includes('coal_ore') || name.includes('iron_ore') || name.includes('copper_ore') ||
                              name.includes('gold_ore') || name.includes('redstone_ore') || name.includes('diamond_ore') ||
                              name.includes('lapis_ore') || name.includes('emerald_ore') || name.includes('quartz_ore') ||
                              name.includes('ancient_debris');
            } else {
              matchesTarget = name.includes(targetOre);
            }
            
            if (!matchesTarget) return false;

            // Bổ sung kiểm tra lộ thiên: Chỉ đào quặng đã lộ ra không khí/nước/dung nham để tránh bị anti-cheat gắn cờ đào xuyên tường/freecam
            if (!isBlockExposed(bot, block)) return false;
            
            // Kiểm tra loại cúp tối thiểu để tránh đào mất (không rơi ra quặng)
            // 1. Vàng, Kim Cương, Đá đỏ, Ngọc lục bảo, Ancient Debris cần cúp Sắt trở lên
            const requiresIronPick = name.includes('gold_ore') || name.includes('redstone_ore') || 
                                     name.includes('diamond_ore') || name.includes('emerald_ore') ||
                                     name.includes('ancient_debris');
            if (requiresIronPick && !inv.hasIronPickaxe) {
              return false;
            }

            // 2. Sắt, Lapis cần cúp Đá trở lên
            const requiresStonePick = name.includes('iron_ore') || name.includes('lapis_ore');
            if (requiresStonePick && !inv.hasStonePickaxe) {
              return false;
            }
            
            return true;
          },
          maxDistance: 16
        });

        if (oreBlock) {
          const oreDisplayName = oreNamesVi[targetOre] || oreBlock.name;
          socket.emit('bot-chat', {
            sender: 'System',
            message: `⛏️ AI Sinh Tồn: Đã tìm thấy ${oreDisplayName} tại (${Math.round(oreBlock.position.x)}, ${Math.round(oreBlock.position.y)}, ${Math.round(oreBlock.position.z)})! Tiến tới khai thác...`,
            time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
          });
          try {
            await bot.pathfinder.goto(new goals.GoalLookAtBlock(oreBlock.position, bot.world));
            await bot.lookAt(oreBlock.position.offset(0.5, 0.5, 0.5));
            const pick = bot.inventory.items().find(i => i.name.includes('_pickaxe'));
            if (pick) await bot.equip(pick, 'hand');
            await bot.dig(oreBlock);
            await new Promise(resolve => setTimeout(resolve, 200));
            await collectNearbyItems(bot);
          } catch (e) {
            console.warn('[AI Survival] Lỗi đào quặng, thêm vào blacklist:', oreBlock.position, e.message);
            bot.failedBlocks.push(oreBlock.position.clone());
          }
          return;
        }
      }

      // 4. Nếu không có gì nguy hiểm và là ban ngày -> đi dạo (tỉ lệ 5%)
      if (!isNight && !isRaining && Math.random() < 0.05 && bot.pathfinder && !bot.pathfinder.isMoving()) {
        const rx = (Math.random() - 0.5) * 10;
        const rz = (Math.random() - 0.5) * 10;
        const targetX = bot.entity.position.x + rx;
        const targetZ = bot.entity.position.z + rz;
        try {
          bot.pathfinder.setGoal(new goals.GoalXZ(targetX, targetZ));
        } catch (e) {}
      }

    } catch (err) {
      console.error('[AI Survival Loop Error]:', err.stack);
    } finally {
      bot.isSurvivalBusy = false;
    }
  }, 1000);
}

// Helper: Đặt bàn chế tạo, làm công cụ và thu hồi
async function craftToolsWithTable(bot, socket, toolToCraft) {
  const { Vec3 } = require('vec3');
  const mcData = require('minecraft-data')(bot.version);

  // 1. Tìm khối đất/khối rắn bên cạnh bot để đặt bàn chế tạo lên (tránh tự kẹt và va chạm hình hộp)
  if (!bot.entity || !bot.entity.position) return;
  const botFloorPos = bot.entity.position.floored();
  const referenceBlock = bot.findBlock({
    matching: block => {
      if (!block || !block.position || block.name === 'air' || block.name === 'water' || block.name === 'lava' || block.name === 'crafting_table') return false;
      
      // Tránh block trực tiếp dưới chân bot
      const distToFeet = block.position.distanceTo(botFloorPos.offset(0, -1, 0));
      if (distToFeet < 0.5) return false;
      
      // Đảm bảo block ngay trên referenceBlock là trống hoặc cỏ/tuyết có thể thay thế được
      const blockAbove = bot.blockAt(block.position.offset(0, 1, 0));
      if (!blockAbove) return false;
      const passable = ['air', 'snow', 'grass', 'fern', 'bush', 'flower', 'tall_grass'].some(name => blockAbove.name.includes(name));
      if (!passable) return false;

      // Tránh va chạm với hình hộp (bounding box) của bot
      const targetPos = block.position.offset(0, 1, 0);
      const dx = Math.abs(bot.entity.position.x - (targetPos.x + 0.5));
      const dz = Math.abs(bot.entity.position.z - (targetPos.z + 0.5));
      const dy = Math.abs(bot.entity.position.y - targetPos.y);
      if (dx < 0.7 && dz < 0.7 && dy < 1.8) return false;

      return true;
    },
    maxDistance: 4
  });

  if (!referenceBlock) {
    console.warn('[AI Survival] Không tìm thấy block thích hợp để đặt bàn chế tạo.');
    return;
  }

  try {
    // 2. Trang bị bàn chế tạo lên tay
    const tableItem = bot.inventory.items().find(i => i.name === 'crafting_table');
    if (!tableItem) return;

    await bot.equip(tableItem, 'hand');

    // Quay mặt nhìn vào điểm đặt để tránh lỗi đặt lệch/hụt
    await bot.lookAt(referenceBlock.position.offset(0.5, 1.0, 0.5));

    // Đặt bàn chế tạo trên mặt trên của block tham chiếu
    const faceVector = new Vec3(0, 1, 0);
    await bot.placeBlock(referenceBlock, faceVector);

    // Chờ 0.5s để server cập nhật block đặt
    await new Promise(resolve => setTimeout(resolve, 500));

    // 3. Tìm block bàn chế tạo vừa đặt trong thế giới
    const tableBlock = bot.findBlock({
      matching: block => block && block.name === 'crafting_table',
      maxDistance: 5
    });

    if (tableBlock) {
      // 4. Tiến hành chế tạo công cụ chính (wooden_pickaxe hoặc stone_pickaxe)
      const targetTool = mcData.itemsByName[toolToCraft];
      if (targetTool) {
        const recipe = bot.recipesFor(targetTool.id, null, 1, tableBlock)[0];
        if (recipe) {
          await bot.craft(recipe, 1, tableBlock);
          socket.emit('bot-chat', {
            sender: 'System',
            message: `✔️ AI Sinh Tồn: Chế tạo thành công [${targetTool.displayName}]!`,
            time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
          });
        }
      }

      // Chế tạo thêm Kiếm gỗ/đá nếu chưa có vũ khí tốt để tự vệ
      const isStone = toolToCraft.startsWith('stone');
      const swordToCraft = isStone ? 'stone_sword' : 'wooden_sword';
      const targetSword = mcData.itemsByName[swordToCraft];
      const items = bot.inventory.items();
      const hasGoodSword = items.some(i => i.name === swordToCraft || i.name.includes('iron_sword') || i.name.includes('diamond_sword'));
      
      if (targetSword && !hasGoodSword) {
        const recipeSword = bot.recipesFor(targetSword.id, null, 1, tableBlock)[0];
        if (recipeSword) {
          await bot.craft(recipeSword, 1, tableBlock);
          socket.emit('bot-chat', {
            sender: 'System',
            message: `✔️ AI Sinh Tồn: Chế tạo thành công [${targetSword.displayName}]!`,
            time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
          });
        }
      }

      // 5. Đập vỡ bàn chế tạo để thu hồi lại
      socket.emit('bot-chat', {
        sender: 'System',
        message: '🛠️ AI Sinh Tồn: Đập phá bàn chế tạo để thu hồi vào hòm đồ...',
        time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
      });
      // Trang bị rìu hoặc cúp để đập bàn chế tạo nhanh hơn
      const tool = bot.inventory.items().find(i => i.name.includes('_axe') || i.name.includes('_pickaxe'));
      if (tool) await bot.equip(tool, 'hand');
      await bot.dig(tableBlock);
      await new Promise(resolve => setTimeout(resolve, 200));
      await collectNearbyItems(bot);
    }
  } catch (err) {
    console.error('[AI Survival Crafting Error]:', err.message);
  }
}

function stopSurvivalLoop(bot) {
  bot.isSurvivalBusy = false;
  if (bot.survivalInterval) {
    clearInterval(bot.survivalInterval);
    bot.survivalInterval = null;
  }
  if (bot.aiSurvivalDeathHandler) {
    bot.removeListener('death', bot.aiSurvivalDeathHandler);
    bot.aiSurvivalDeathHandler = null;
  }
  if (bot.pathfinder) {
    try {
      bot.pathfinder.setGoal(null);
    } catch (e) {}
  }
}

// Hàm tự động phát hiện và giải quyết Captcha dạng văn bản bằng Regex
function checkAndSolveCaptcha(messageStr, bot) {
  if (!messageStr || !bot) return;

  // Bỏ qua nếu tin nhắn đến từ người chơi khác hoặc tin nhắn riêng (tránh bị dụ dỗ giải hộ)
  if (parsePublicChatMessage(messageStr, bot.players) || parseWhisperMessage(messageStr)) {
    return;
  }

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

// Hàm ping server trả về Promise để đồng bộ hóa việc dò tìm phiên bản
function pingServerPromise(host, port) {
  const mc = require('minecraft-protocol');
  return new Promise((resolve) => {
    mc.ping({ host, port, timeout: 4000 }, (err, results) => {
      if (err) resolve(null);
      else resolve(results);
    });
  });
}


// Hàm tìm cổng TCP rảnh ngẫu nhiên để tránh xung đột cổng
function getFreePort() {
  const net = require('net');
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => {
        resolve(port);
      });
    });
  });
}

// Hàm tự động phát hiện và thực hiện Đăng ký / Đăng nhập (AuthMe) bảo mật
function checkAndHandleAuth(messageStr, bot, password) {
  if (!messageStr || !bot || !password) return;

  // Bỏ qua nếu tin nhắn đến từ người chơi khác hoặc tin nhắn riêng (tránh bị dụ dỗ đăng xuất/đăng nhập)
  if (parsePublicChatMessage(messageStr, bot.players) || parseWhisperMessage(messageStr)) {
    return;
  }

  const cleanMsg = messageStr.toLowerCase();

  // Bỏ qua nếu tin nhắn chứa thông báo đã đăng nhập rồi hoặc đăng nhập thành công để tránh vòng lặp gửi lệnh liên tục
  if (cleanMsg.includes('thành công') || cleanMsg.includes('thanh cong') || 
      cleanMsg.includes('đã đăng nhập') || cleanMsg.includes('da dang nhap') ||
      cleanMsg.includes('already connected') || cleanMsg.includes('already logged') ||
      cleanMsg.includes('bạn đã đăng nhập') || cleanMsg.includes('ban da dang nhap')) {
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

// Hàm kiểm tra xem tin nhắn có phải tin nhắn riêng (Whisper/PM) hay không
function isWhisperMessage(msg) {
  return !!parseWhisperMessage(msg);
}

// Hàm kiểm tra xem tin nhắn có phải chát công khai của người chơi khác hay không
function isPublicChatMessage(msg, players = {}) {
  return !!parsePublicChatMessage(msg, players);
}

// Hàm phân tích tin nhắn riêng (Whisper/PM) trả về đối tượng chi tiết hoặc null
function parseWhisperMessage(msg) {
  if (!msg) return null;
  const cleanMsg = msg.trim();

  // Pattern 1: [Sender -> Receiver] message or [Sender -> me] message
  const pattern1 = /^\[\s*([a-zA-Z0-9_]{3,16})\s*(?:->|<-|đã gửi cho|gửi cho|to)\s*([a-zA-Z0-9_]{2,16}|tôi|toi|bạn|ban|me)\s*\]\s*(.*)$/i;
  const match1 = cleanMsg.match(pattern1);
  if (match1) {
    return {
      sender: match1[1],
      receiver: match1[2],
      message: match1[3],
      type: 'private'
    };
  }

  // Pattern 1b: Reverse of 1 (e.g. [Tôi -> Huyphan] hello)
  const pattern1b = /^\[\s*(tôi|toi|bạn|ban|me)\s*(?:->|<-|đã gửi cho|gửi cho|to)\s*([a-zA-Z0-9_]{3,16})\s*\]\s*(.*)$/i;
  const match1b = cleanMsg.match(pattern1b);
  if (match1b) {
    return {
      sender: match1b[1],
      receiver: match1b[2],
      message: match1b[3],
      type: 'private'
    };
  }

  // Pattern 2: Sender whispers to you: message or Sender whispers: message
  const pattern2 = /^([a-zA-Z0-9_]{3,16})\s+(?:whispers to you|whispers|nhắn cho bạn|gửi cho bạn|nhắn|gửi)\s*[:>»→-]?\s*(.*)$/i;
  const match2 = cleanMsg.match(pattern2);
  if (match2) {
    return {
      sender: match2[1],
      receiver: 'me',
      message: match2[2],
      type: 'private'
    };
  }

  // Pattern 3: Sender -> Bạn: message
  const pattern3 = /^([a-zA-Z0-9_]{3,16})\s*(?:->|<-)\s*(bạn|ban|tôi|toi|tui)\s*[:>»→-]\s*(.*)$/i;
  const match3 = cleanMsg.match(pattern3);
  if (match3) {
    return {
      sender: match3[1],
      receiver: match3[2],
      message: match3[3],
      type: 'private'
    };
  }

  return null;
}


// Helper phân tích yêu cầu TPA từ tin nhắn chat
function parseTpaRequest(messageStr) {
  if (!messageStr) return null;
  const cleanStr = messageStr.trim().replace(/\s+/g, ' ');
  
  // Các mẫu tiếng Anh và tiếng Việt
  const patterns = [
    // TPA (yêu cầu dịch chuyển đến bot)
    {
      regex: /([a-zA-Z0-9_]{2,16})\s+(?:wants\s+to\s+teleport\s+to\s+you|has\s+requested\s+to\s+teleport\s+to\s+you)/i,
      type: 'tpa'
    },
    {
      regex: /([a-zA-Z0-9_]{2,16})\s+(?:muốn\s+dịch\s+chuyển\s+đến\s+bạn|yêu\s+cầu\s+dịch\s+chuyển\s+đến\s+bạn)/i,
      type: 'tpa'
    },
    // TPAHere (yêu cầu kéo bot đến chỗ họ)
    {
      regex: /([a-zA-Z0-9_]{2,16})\s+(?:wants\s+you\s+to\s+teleport\s+to\s+them|has\s+requested\s+that\s+you\s+teleport\s+to\s+them)/i,
      type: 'tpahere'
    },
    {
      regex: /([a-zA-Z0-9_]{2,16})\s+(?:muốn\s+bạn\s+dịch\s+chuyển\s+đến\s+họ|yêu\s+cầu\s+bạn\s+dịch\s+chuyển\s+đến\s+họ)/i,
      type: 'tpahere'
    }
  ];

  for (const pattern of patterns) {
    const match = cleanStr.match(pattern.regex);
    if (match) {
      return {
        sender: match[1],
        type: pattern.type
      };
    }
  }
  return null;
}

// Hàm phân tích chát công khai của người chơi khác
function parsePublicChatMessage(msg, players = {}) {
  if (!msg) return null;
  const cleanMsg = msg.trim();

  // Danh sách các từ khóa loại trừ không phải tên người chơi
  const excludeNames = ['system', 'server', 'admin', 'info', 'warn', 'error', 'lỗi', 'hệ thống', 'thông báo', 'lobby', 'sảnh'];

  // Ký tự phân cách: ->, <-, :, », →, >, -
  const separators = ['->', '<-', ':', '»', '→', '>', '-'];
  let firstSepIdx = -1;
  let matchedSep = '';

  for (let sep of separators) {
    const idx = cleanMsg.indexOf(sep);
    if (idx !== -1) {
      if (firstSepIdx === -1 || idx < firstSepIdx) {
        firstSepIdx = idx;
        matchedSep = sep;
      }
    }
  }

  if (firstSepIdx === -1) return null;

  const leftPart = cleanMsg.substring(0, firstSepIdx).trim();
  const rightPart = cleanMsg.substring(firstSepIdx + matchedSep.length).trim();

  if (!rightPart) return null; // Tin nhắn không được rỗng

  // Tìm tất cả các từ dạng username hợp lệ trong phần bên trái
  const words = leftPart.match(/\b([a-zA-Z0-9_]{3,16})\b/g);
  if (!words || words.length === 0) return null;

  // Phân tích từ phải sang trái (gần dấu phân cách nhất)
  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i];
    const wordLower = word.toLowerCase();

    if (excludeNames.includes(wordLower)) {
      continue;
    }

    const isOnline = Object.keys(players).some(p => p.toLowerCase() === wordLower);
    const isLastWord = (i === words.length - 1);

    if (isOnline || isLastWord) {
      // Trích xuất prefix (phần trước tên người gửi)
      const wordIdx = leftPart.lastIndexOf(word);
      let prefix = '';
      if (wordIdx !== -1) {
        prefix = leftPart.substring(0, wordIdx).trim();
      }

      return {
        prefix: prefix,
        sender: word,
        message: rightPart,
        type: 'public'
      };
    }
  }

  return null;
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

// Phục vụ các tệp tĩnh của thư mục frontend trực tiếp từ backend
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend')));

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
// Lưu trữ bộ quét radar thời gian thực (blocks và entities)
const radarIntervals = {};
// Lưu trữ các localtunnel instance theo Socket ID
const activeTunnels = {};
// Lưu trữ số lần timeout liên tiếp để thực hiện exponential backoff
const timeoutRetryCounts = {};
// Lưu trữ thời điểm bot bị ngắt kết nối gần nhất theo Socket ID (chống bị chặn IP do kết nối lại quá nhanh)
const lastDisconnectTimes = {};


// Biến toàn cục lưu trữ URL Camera 3D
let globalCameraUrl = '';

// Khởi chạy localtunnel/camera tunnel ở port 3001 ngay khi khởi động backend
async function startCameraTunnel() {
  const port = 3001;
  const isRemote = process.env.RENDER || process.env.HEROKU || process.env.RAILWAY_ENVIRONMENT || process.env.FLY_APP_NAME;
  
  if (isRemote) {
    try {
      const localtunnel = require('localtunnel');
      console.log(`[Camera Tunnel] Đang khởi tạo localtunnel trên port ${port}...`);
      const tunnel = await localtunnel({ port });
      globalCameraUrl = tunnel.url;
      console.log(`[Camera Tunnel] Khởi tạo thành công. Public URL: ${globalCameraUrl}`);
      
      tunnel.on('close', () => {
        console.log(`[Camera Tunnel] Tunnel đã bị đóng. Đang khởi động lại sau 5s...`);
        globalCameraUrl = '';
        setTimeout(startCameraTunnel, 5000);
      });
      
      tunnel.on('error', (err) => {
        console.error(`[Camera Tunnel] Lỗi tunnel:`, err.message);
      });
    } catch (err) {
      console.error(`[Camera Tunnel] Lỗi khi tạo localtunnel:`, err.message);
      setTimeout(startCameraTunnel, 10000);
    }
  } else {
    // Chạy local thì dùng localhost:3001 trực tiếp
    globalCameraUrl = `http://localhost:${port}`;
    console.log(`[Camera Tunnel] Chạy local. URL Camera mặc định: ${globalCameraUrl}`);
  }
}

// Khởi chạy tunnel ngay lập tức
startCameraTunnel().catch(() => {});

io.on('connection', (socket) => {
  console.log(`[Socket] Client kết nối mới: ${socket.id}`);

  // Lập tức gửi public URL của camera cho client kết nối để iframe load sẵn
  if (globalCameraUrl) {
    socket.emit('camera_url', globalCameraUrl);
  }

  // Gửi trạng thái ban đầu của bot cho client mới kết nối
  const existingBot = activeBots['default_bot'];
  if (existingBot) {
    const isOnline = existingBot.entity && existingBot.entity.id !== -1;
    socket.emit('bot-status', { 
      status: isOnline ? 'online' : 'connecting', 
      message: `Bot ${existingBot.username} đang hoạt động.` 
    });
    // Gửi thông tin hiện tại
    socket.emit('bot-info', {
      username: existingBot.username,
      health: existingBot.health,
      food: existingBot.food,
      coords: existingBot.entity && existingBot.entity.position ? {
        x: existingBot.entity.position.x.toFixed(2),
        y: existingBot.entity.position.y.toFixed(2),
        z: existingBot.entity.position.z.toFixed(2)
      } : { x: '0.00', y: '0.00', z: '0.00' }
    });
  } else {
    socket.emit('bot-status', { status: 'offline', message: 'Chưa kết nối bot' });
  }

  // Hàm khởi tạo và quản lý kết nối bot Minecraft
  async function connectBot(config) {
    const { host, port, username, password, version, auth, autoReconnect } = config;
    const socketId = 'default_bot';

    // Shadow the outer socket variable to broadcast events via io.emit to all clients
    const socket = {

      emit: (event, data) => io.emit(event, data),
      get id() { return 'default_bot'; },
      get connected() { return io.sockets.sockets.size > 0; }
    };

    // Kiểm tra cooldown chống bị chặn IP do kết nối lại quá nhanh (đặc biệt là sau khi Captcha solved kick)
    const lastDisconnectTime = lastDisconnectTimes[socketId] || 0;
    const timeSinceLastDisconnect = Date.now() - lastDisconnectTime;
    const cooldownMs = 15000; // 15 giây cooldown
    if (timeSinceLastDisconnect < cooldownMs) {
      const remainingMs = cooldownMs - timeSinceLastDisconnect;
      const remainingSec = Math.ceil(remainingMs / 1000);
      console.log(`[Bot] Kết nối quá nhanh sau khi ngắt kết nối. Trì hoãn kết nối thêm ${remainingSec} giây để tránh bị chặn IP...`);
      socket.emit('bot-status', { 
        status: 'connecting', 
        message: `Đang chờ ${remainingSec}s để tránh bị Firewall/Anti-bot chặn (Reconnect Cooldown)...` 
      });

      if (reconnectTimers[socketId]) {
        clearTimeout(reconnectTimers[socketId]);
      }
      
      reconnectTimers[socketId] = setTimeout(() => {
        delete reconnectTimers[socketId];
        connectBot(config);
      }, remainingMs);
      return;
    }


    // Lưu các tên thực thể đã log để tránh gửi trùng lặp
    const loggedEntityNames = {};
    let loginTimeoutTimer = null;
    let hasLoggedIn = false;
    let hasDisconnected = false;

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

      const name = getEntityName(entity, bot);
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
        const oldBot = activeBots[socketId];
        if (oldBot.viewer) {
          try {
            oldBot.viewer.close();
            console.log('[Bot] Đã đóng viewer của bot cũ thành công.');
          } catch (e) {
            console.error('[Bot] Lỗi khi đóng viewer của bot cũ:', e.message);
          }
        }
        oldBot.end();
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

    // Xóa bộ quét radar cũ nếu có
    if (radarIntervals[socketId]) {
      clearInterval(radarIntervals[socketId]);
      delete radarIntervals[socketId];
    }

    let resolvedVersion = version && version !== 'auto' ? version : false;

    if (version === 'auto') {
      socket.emit('bot-status', { status: 'connecting', message: 'Đang tự động kiểm tra phiên bản server...' });
      try {
        console.log(`[Bot] Đang ping tự động kiểm tra phiên bản server: ${host}:${parseInt(port) || 25565}`);
        const results = await pingServerPromise(host, parseInt(port) || 25565);
        if (results && results.version) {
          const protocol = results.version.protocol;
          const pcVersions = require('minecraft-data').versionsByMinecraftVersion.pc;
          for (const verName in pcVersions) {
            if (pcVersions[verName].version === protocol) {
              resolvedVersion = verName;
              break;
            }
          }
          if (!resolvedVersion && results.version.name) {
            const match = results.version.name.match(/\b\d+\.\d+(?:\.\d+)*\b/);
            if (match) {
              resolvedVersion = match[0];
            }
          }
          if (resolvedVersion) {
            console.log(`[Bot] Đã tự động nhận diện phiên bản: ${resolvedVersion} (Protocol: ${protocol})`);
          } else {
            console.log(`[Bot] Không tự động nhận diện được phiên bản từ Protocol: ${protocol}`);
          }
        } else {
          console.log(`[Bot] Ping tự động tìm phiên bản không nhận được kết quả (Server offline hoặc sai Port).`);
        }
      } catch (err) {
        console.error(`[Bot] Lỗi khi ping tự động tìm phiên bản:`, err.message);
      }
    }


    socket.emit('bot-status', { status: 'connecting', message: 'Đang kết nối tới server Minecraft...' });

    // Khởi tạo Mineflayer Bot Options
    const botOptions = {
      host: host,
      port: parseInt(port) || 25565,
      username: username || `Bot_${Math.floor(Math.random() * 1000)}`,
      auth: auth === 'microsoft' ? 'microsoft' : 'offline',
      version: resolvedVersion,
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
      bot.miningTargetOre = config.miningTarget || 'all'; // Lưu quặng ưu tiên đào từ cấu hình người dùng
      bot.autoAcceptTpa = config.autoAcceptTpa === true; // Lưu cấu hình tự động đồng ý TPA
      bot.entity = { id: -1 }; // Khởi tạo để tránh crash lỗi entity_status khi chưa login
      bot.hasSwitchedLobby = false; // Đánh dấu chưa chuyển cụm sảnh
      
      // Chặn và loại bỏ các thực thể Display và các thực thể dễ gây lỗi tương thích
      // (text_display, item_display, block_display, interaction, item, xp_orb)
      // để tránh làm crash vòng lặp render Three.js của prismarine-viewer trên giao diện Client
      const originalEmit = bot.emit;
      const filteredEntities = ['text_display', 'item_display', 'block_display', 'interaction', 'item', 'xp_orb'];
      bot.emit = function (event, ...args) {
        if (event === 'entitySpawn' || event === 'entityMoved' || event === 'entityUpdate') {
          const entity = args[0];
          if (entity && filteredEntities.includes(entity.name)) {
            if (event === 'entitySpawn' && bot.entities) {
              delete bot.entities[entity.id];
            }
            return; // Bỏ qua không phát sự kiện cho các plugin khác (như viewer)
          }
        }
        return originalEmit.apply(this, [event, ...args]);
      };
      
      // Load plugins cho hack client (Killaura, Auto-Eat, Auto-Armor)
      try {
        const { pathfinder } = require('mineflayer-pathfinder');
        const { plugin: pvpPlugin } = require('mineflayer-pvp');
        const autoEatPlugin = require('mineflayer-auto-eat').loader;
        const armorManagerPlugin = require('mineflayer-armor-manager');
        bot.loadPlugin(pathfinder);
        bot.loadPlugin(pvpPlugin);
        bot.loadPlugin(autoEatPlugin);
        bot.loadPlugin(armorManagerPlugin);
        console.log('[Bot] Đã tải thành công các plugin Pathfinder, PVP, Auto-Eat và Armor Manager.');
      } catch (loadPluginsErr) {
        console.error('[Bot] Lỗi khi tải các plugin bổ sung:', loadPluginsErr.message);
      }

      activeBots[socketId] = bot;
      botConfigs[socketId] = config; // Lưu cấu hình lại để reconect

      // Cấu hình timeout kết nối nếu sau 45 giây chưa đăng nhập thành công
      loginTimeoutTimer = setTimeout(() => {
        console.log(`[Bot] Kết nối tới ${host}:${port} quá thời gian chờ (45s). Tiến hành đóng kết nối.`);
        try {
          bot.end();
        } catch (e) {
          console.error('[Bot] Lỗi khi đóng bot do timeout:', e.message);
        }
        handleBotDisconnect('Lỗi: Kết nối quá thời gian chờ (Timeout 45s)');
      }, 45000);

    } catch (error) {
      console.error('[Bot] Khởi tạo mineflayer thất bại:', error.message);
      socket.emit('bot-status', { status: 'error', message: `Không thể tạo Bot: ${error.message}` });
      return;
    }

    function handleBotDisconnect(reasonText, isError = false) {
      if (hasDisconnected) return;
      hasDisconnected = true;

      // Lưu thời điểm ngắt kết nối gần nhất của bot
      lastDisconnectTimes[socketId] = Date.now();

      // Đóng viewer 3D, localtunnel và dừng killaura nếu có
      if (bot) {
        stopSurvivalLoop(bot);
        if (bot.killauraInterval) {
          clearInterval(bot.killauraInterval);
          bot.killauraInterval = null;
          console.log(`[Bot] Đã tắt killaura của ${socketId} do ngắt kết nối.`);
        }
        if (bot.pvp) {
          try { bot.pvp.stop(); } catch (e) {}
        }
        try {
          if (bot.viewer) {
            bot.viewer.close();
            console.log(`[Bot] Đã đóng viewer của ${socketId}`);
          }
        } catch (e) {
          console.error('[Bot] Lỗi khi đóng viewer:', e.message);
        }
      }
      if (activeTunnels[socketId]) {
        try {
          activeTunnels[socketId].close();
          console.log(`[Bot] Đã đóng localtunnel của ${socketId}`);
        } catch (e) {
          console.error('[Bot] Lỗi khi đóng localtunnel:', e.message);
        }
        delete activeTunnels[socketId];
      }

      let finalReasonText = reasonText;
      if (reasonText.includes('ECONNREFUSED')) {
        finalReasonText = 'Lỗi: Server đang Offline hoặc Cổng (Port) không chính xác';
      } else if (reasonText.includes('ETIMEDOUT')) {
        finalReasonText = 'Lỗi: Không thể kết nối tới Server (Server Offline hoặc bị Tường lửa chặn)';
      } else if (reasonText.includes('ECONNABORTED')) {
        finalReasonText = 'Lỗi: Server đóng kết nối ngay lập tức. Có thể do sai phiên bản hoặc server có Anti-bot.';
      } else if (reasonText.includes('ECONNRESET') || reasonText.includes('socketClosed') || reasonText.includes('EPIPE') || reasonText.includes('write EPIPE')) {
        finalReasonText = 'Lỗi: Kết nối bị ngắt đột ngột (EPIPE/ECONNRESET). Hãy kiểm tra: 1. Đúng phiên bản Minecraft (hãy chọn phiên bản cụ thể thay vì Auto); 2. Server có Anti-bot đang chặn kết nối; 3. Chọn sai chế độ Xác thực (Auth).';
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

      // Xóa bộ quét radar
      if (radarIntervals[socketId]) {
        clearInterval(radarIntervals[socketId]);
        delete radarIntervals[socketId];
      }

      // Nếu socket client đã ngắt kết nối khỏi server backend, giải phóng tài nguyên ngay
      if (!socket.connected) {
        if (activeBots[socketId] === bot) {
          delete activeBots[socketId];
        }
        delete botConfigs[socketId];
        return;
      }

      if (activeBots[socketId] === bot) {
        delete activeBots[socketId];
      }

      // Nếu người dùng bật Auto Reconnect, thực hiện đếm ngược kết nối lại
      if (autoReconnect) {
        // Nếu bị Timeout, thử kết nối lại với exponential backoff (30s → 60s → 90s, tối đa 3 lần)
        if (finalReasonText.includes('Timeout')) {
          if (!timeoutRetryCounts[socketId]) timeoutRetryCounts[socketId] = 0;
          timeoutRetryCounts[socketId]++;
          
          if (timeoutRetryCounts[socketId] > 3) {
            console.log(`[Bot] Đã thử kết nối lại ${timeoutRetryCounts[socketId] - 1} lần sau timeout. Dừng auto-reconnect.`);
            timeoutRetryCounts[socketId] = 0;
            socket.emit('bot-status', { 
              status: 'error', 
              message: `${finalReasonText}. Đã thử lại 3 lần không thành công. Vui lòng thử lại thủ công sau 1-2 phút.` 
            });
            return;
          }
          
          const backoffDelay = timeoutRetryCounts[socketId] * 30000; // 30s, 60s, 90s
          const backoffSec = backoffDelay / 1000;
          
          if (!reconnectTimers[socketId]) {
            console.log(`[Bot] Timeout lần ${timeoutRetryCounts[socketId]}/3. Tự động kết nối lại sau ${backoffSec} giây...`);
            socket.emit('bot-status', { 
              status: 'connecting', 
              message: `${finalReasonText}. Thử lại lần ${timeoutRetryCounts[socketId]}/3 sau ${backoffSec}s...` 
            });
            reconnectTimers[socketId] = setTimeout(() => {
              delete reconnectTimers[socketId];
              if (socket.connected) {
                connectBot(config);
              }
            }, backoffDelay);
          }
          return;
        }

        if (!reconnectTimers[socketId]) {
          // Xác định thời gian chờ kết nối lại (cooldown mặc định 15s để tránh bị chặn bởi anti-bot/firewall)
          const lowerText = finalReasonText.toLowerCase();
          const isRejoinKick = lowerText.includes('rejoin') || 
                               lowerText.includes('solved') || 
                               lowerText.includes('vào lại') || 
                               lowerText.includes('kết nối lại');
          const delayMs = isRejoinKick ? 15000 : 15000; // Đặt cả hai đều là 15 giây cho đồng bộ và an toàn
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
      bot.physicsEnabled = false;
      console.log(`[Bot] Bot [${bot.username}] đã đăng nhập vào server (đang chờ spawn). Tắt tạm thời physics.`);
      timeoutRetryCounts[socketId] = 0; // Reset bộ đếm timeout khi đăng nhập thành công
      if (loginTimeoutTimer) {
        clearTimeout(loginTimeoutTimer);
        loginTimeoutTimer = null;
      }

      console.log(`[Bot] Bot [${bot.username}] đã đăng nhập vào server (đang chờ spawn).`);
      socket.emit('bot-status', { 
        status: 'online', 
        message: `Đã kết nối thành công với tên: ${bot.username} (Đang chờ tải thế giới...)` 
      });

      // Tránh đăng ký trùng lặp sự kiện và gắn lại viewer khi chuyển server selector trong mạng proxy (như Bungee/Velocity)
      if (bot.hasInitializedEvents) {
        console.log('[Bot] Bot đã được khởi tạo các sự kiện trước đó, bỏ qua đăng ký lại.');
        
        // Đóng viewer cũ nếu đang chạy để tránh chiếm dụng port và gắn vào client mới
        if (bot.viewer) {
          try {
            bot.viewer.close();
            console.log('[Bot] Đã đóng viewer cũ thành công khi chuyển cụm.');
          } catch (e) {
            console.error('[Bot] Lỗi khi đóng viewer cũ:', e.message);
          }
        }
        
        // Khởi động lại Viewer 3D gắn vào client mới
        try {
          const { mineflayer: mineflayerViewer } = require('prismarine-viewer');
          mineflayerViewer(bot, { port: 3001, firstPerson: true });
          console.log('[Bot] Viewer 3D đã được tạo lại và gắn vào bot ở cụm mới.');
        } catch (e) {
          console.error('[Bot] Lỗi khi khởi động lại viewer khi chuyển cụm:', e.message);
        }
        
        socket.emit('camera_url', globalCameraUrl);
        return;
      }
      bot.hasInitializedEvents = true;

      // Khởi động Camera View 3D lập tức ngay khi login để không bỏ lỡ giây nào ở sảnh chờ/hàng chờ
      try {
        const { mineflayer: mineflayerViewer } = require('prismarine-viewer');
        mineflayerViewer(bot, { port: 3001, firstPerson: true });
        console.log(`[Bot] Viewer 3D đã gắn thành công vào bot ở port 3001 khi login.`);
        
        // Phát sự kiện camera_url tới client để hiển thị Camera 3D
        socket.emit('camera_url', globalCameraUrl);
      } catch (viewerErr) {
        console.error('[Bot] Lỗi khi gắn prismarine-viewer vào bot:', viewerErr.message);
      }

      // Theo dõi thay đổi hòm đồ để phát hiện và tự động cầm bản đồ captcha ngay khi nhận được
      let inventoryUpdateTimeout = null;
      const sendInventoryUpdate = () => {
        if (inventoryUpdateTimeout) clearTimeout(inventoryUpdateTimeout);
        inventoryUpdateTimeout = setTimeout(() => {
          if (bot && bot.inventory) {
            const slotsData = [];
            for (let i = 0; i < 46; i++) {
              const item = bot.inventory.slots[i];
              if (item) {
                slotsData.push({
                  slot: i,
                  name: item.name,
                  displayName: getFormattedItemName(item, bot),
                  count: item.count
                });
              } else {
                slotsData.push(null);
              }
            }
            socket.emit('bot-inventory', slotsData);
          }
        }, 100);
      };

      if (bot.inventory) {
        // Gửi trạng thái hòm đồ ban đầu
        sendInventoryUpdate();

        bot.inventory.on('updateSlot', (slot, oldItem, newItem) => {
          // Gửi bản cập nhật hòm đồ lên frontend
          sendInventoryUpdate();

          if (bot.autoArmorEnabled && bot.armorManager && !bot.isEquippingArmor) {
            bot.isEquippingArmor = true;
            bot.armorManager.equipAll()
              .catch(() => {})
              .finally(() => {
                bot.isEquippingArmor = false;
              });
          }

          if (newItem) {
            const isMap = newItem.name && (newItem.name.includes('map') || newItem.name.includes('filled_map'));
            
            if (isMap) {
              console.log(`[Bot] Hòm đồ cập nhật bản đồ (Slot ${slot}): ${newItem.name} x ${newItem.count}`);
              socket.emit('bot-chat', {
                sender: 'System',
                message: `[Hòm đồ - Nhận] Slot ${slot}: ${newItem.displayName || newItem.name} (Số lượng: ${newItem.count})`,
                time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
              });

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

      // Khởi tạo quét radar thời gian thực gửi lên frontend mỗi 500ms
      if (radarIntervals[socketId]) {
        clearInterval(radarIntervals[socketId]);
      }
      radarIntervals[socketId] = setInterval(() => {
        if (!activeBots[socketId] || !bot.entity) return;
        
        try {
          const botPos = bot.entity.position;
          
          // 1. Quét blocks xung quanh (lưới 33x33 - bán kính 16 block)
          const blocks = [];
          const range = 16; // bán kính 16 ô
          
          for (let dz = -range; dz <= range; dz++) {
            for (let dx = -range; dx <= range; dx++) {
              let blockType = 0; // 0: air/void
              
              // 1.1 Tìm quặng trước trong toàn bộ cột Y+2 đến Y-10 để ưu tiên hiển thị quặng
              let foundOreType = 0;
              for (let dy = 2; dy >= -10; dy--) {
                const pos = botPos.offset(dx, dy, dz);
                const block = bot.blockAt(pos);
                if (block && block.name) {
                  const bName = block.name.toLowerCase();
                  let isOre = false;
                  let potentialType = 0;
                  if (bName.includes('coal_ore')) { isOre = true; potentialType = 10; }
                  else if (bName.includes('iron_ore')) { isOre = true; potentialType = 11; }
                  else if (bName.includes('copper_ore')) { isOre = true; potentialType = 12; }
                  else if (bName.includes('gold_ore')) { isOre = true; potentialType = 13; }
                  else if (bName.includes('redstone_ore')) { isOre = true; potentialType = 14; }
                  else if (bName.includes('lapis_ore')) { isOre = true; potentialType = 15; }
                  else if (bName.includes('diamond_ore')) { isOre = true; potentialType = 16; }
                  else if (bName.includes('emerald_ore')) { isOre = true; potentialType = 17; }
                  else if (bName.includes('quartz_ore')) { isOre = true; potentialType = 18; }
                  else if (bName.includes('ancient_debris')) { isOre = true; potentialType = 19; }
                  
                  // Chỉ hiển thị trên radar nếu quặng LỘ THIÊN để tránh fake ore của Anti-Xray làm nhiễu
                  if (isOre && isBlockExposed(bot, block)) {
                    foundOreType = potentialType;
                    break;
                  }
                }
              }

              if (foundOreType > 0) {
                blockType = foundOreType;
              } else {
                // 1.2 Nếu không tìm thấy quặng, quét tìm block sàn thông thường
                for (let dy = 2; dy >= -10; dy--) {
                  const pos = botPos.offset(dx, dy, dz);
                  const block = bot.blockAt(pos);
                  
                  if (block && block.name && block.name !== 'air') {
                    const bName = block.name.toLowerCase();
                    if (bName.includes('grass') || bName.includes('leaves') || bName.includes('dandelion') || bName.includes('poppy') || bName.includes('fern') || bName.includes('sapling')) {
                      blockType = 1; // 1: cỏ/lá
                    } else if (bName.includes('water')) {
                      blockType = 3; // 3: nước
                    } else if (bName.includes('lava')) {
                      blockType = 4; // 4: dung nham
                    } else if (bName.includes('wood') || bName.includes('log') || bName.includes('plank') || bName.includes('fence') || bName.includes('door') || bName.includes('chest')) {
                      blockType = 5; // 5: gỗ
                    } else if (bName.includes('stone') || bName.includes('cobble') || bName.includes('deepslate') || bName.includes('andesite') || bName.includes('diorite') || bName.includes('granite') || bName.includes('brick') || bName.includes('obsidian') || bName.includes('tuff')) {
                      blockType = 2; // 2: đá/gạch
                    } else {
                      blockType = 6; // 6: khối rắn khác
                    }
                    break; // Tìm thấy sàn, chuyển sang ô tiếp theo
                  }
                }
              }
              blocks.push(blockType);
            }
          }
          
          // Thống kê số lượng quặng thực tế trong bán kính 16 block xung quanh bot
          const oreCounts = {
            coal_ore: 0,
            iron_ore: 0,
            copper_ore: 0,
            gold_ore: 0,
            redstone_ore: 0,
            lapis_ore: 0,
            diamond_ore: 0,
            emerald_ore: 0,
            quartz_ore: 0,
            ancient_debris: 0
          };
          
          try {
            const registry = bot.registry || (bot.version ? require('minecraft-data')(bot.version) : require('minecraft-data')('1.21.1'));
            if (registry) {
              const oreIds = Object.values(registry.blocksByName)
                .filter(b => b.name && (b.name.includes('ore') || b.name === 'ancient_debris'))
                .map(b => b.id);
                
              const foundOres = bot.findBlocks({
                matching: oreIds,
                maxDistance: 16,
                count: 300
              });
              
              foundOres.forEach(pos => {
                const block = bot.blockAt(pos);
                if (block && block.name && isBlockExposed(bot, block)) {
                  const bName = block.name.toLowerCase();
                  if (bName.includes('coal_ore')) oreCounts.coal_ore++;
                  else if (bName.includes('iron_ore')) oreCounts.iron_ore++;
                  else if (bName.includes('copper_ore')) oreCounts.copper_ore++;
                  else if (bName.includes('gold_ore')) oreCounts.gold_ore++;
                  else if (bName.includes('redstone_ore')) oreCounts.redstone_ore++;
                  else if (bName.includes('lapis_ore')) oreCounts.lapis_ore++;
                  else if (bName.includes('diamond_ore')) oreCounts.diamond_ore++;
                  else if (bName.includes('emerald_ore')) oreCounts.emerald_ore++;
                  else if (bName.includes('quartz_ore')) oreCounts.quartz_ore++;
                  else if (bName.includes('ancient_debris')) oreCounts.ancient_debris++;
                }
              });
            }
          } catch (err) {
            console.error('[Bot Radar] Lỗi đếm quặng:', err.message);
          }
          
          // 2. Quét thực thể xung quanh (mobs/players)
          const entities = [];
          if (bot.entities) {
            Object.values(bot.entities).forEach(entity => {
              if (!entity || entity.id === bot.entity.id) return;
              
              const relX = entity.position.x - botPos.x;
              const relZ = entity.position.z - botPos.z;
              
              // Khoảng cách euclidean tương đối trong khoảng quét radar
              if (Math.abs(relX) <= 16 && Math.abs(relZ) <= 16) {
                let category = 'other';
                if (entity.type === 'player') {
                  category = 'player';
                } else if (entity.type === 'mob' || entity.type === 'monster') {
                  const passiveMobs = ['cow', 'pig', 'sheep', 'chicken', 'rabbit', 'horse', 'donkey', 'mule', 'llama', 'villager', 'iron_golem', 'squid', 'glow_squid', 'bat', 'bee', 'cat', 'dog', 'wolf', 'fox', 'panda', 'parrot', 'polar_bear', 'strider', 'turtle', 'axolotl'];
                  const name = (entity.name || '').toLowerCase();
                  const isPassive = passiveMobs.some(m => name.includes(m));
                  category = isPassive ? 'passive' : 'hostile';
                }
                
                entities.push({
                  relX: Math.round(relX * 10) / 10,
                  relZ: Math.round(relZ * 10) / 10,
                  name: entity.displayName || entity.name || entity.type,
                  category: category
                });
              }
            });
          }
          
          // Gửi gói dữ liệu radar lên frontend
          socket.emit('bot-radar', {
            yaw: bot.entity.yaw,
            range: range,
            blocks: blocks,
            entities: entities,
            oreCounts: oreCounts
          });
          
        } catch (err) {
          // Bỏ qua lỗi quét radar để tránh crash bot
        }
      }, 500);

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

    // Khởi tạo các cấu hình khi bot spawn lần đầu
    bot.once('spawn', () => {
      // Cấu hình plugin autoEat khi spawn
      if (bot.autoEat) {
        bot.autoEat.options = {
          priority: 'foodPoints',
          eatingTimeout: 3000,
          startAt: 14
        };
        console.log('[Bot] Đã thiết lập thông số mặc định cho Auto-Eat.');
      }
    });

    // 1. Khi bot spawn thành công vào game
    bot.on('spawn', () => {
      bot.physicsEnabled = true;
      console.log(`[Bot] Bot [${bot.username}] đã vào server game thành công. Đã bật lại physics.`);
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

    // Tự động chuyển server khi phát hiện ở sảnh chờ (Click Nether Star "Chọn Cụm" -> Click "Survival Chill")
    bot.on('spawn', () => {
      if (bot.hasSwitchedLobby) {
        console.log('[Lobby Auto] Bot đã chuyển cụm thành công trước đó, bỏ qua chạy lại quét sảnh/chạy lệnh.');
        return;
      }

      // Nếu cấu hình dùng lệnh chuyển cụm thay vì click menu
      if (config.lobbySwitchMethod === 'command') {
        bot.hasSwitchedLobby = true; // Đánh dấu đã chuyển cụm sảnh
        const switchCommand = config.lobbySwitchCommand ? config.lobbySwitchCommand.trim() : '/server chill';
        console.log(`[Lobby Auto] Cấu hình dùng lệnh. Sẽ gửi lệnh chuyển cụm: "${switchCommand}" định kỳ sau mỗi 4 giây...`);
        let commandCount = 0;
        const maxCommands = 5;
        
        const sendCommandInterval = setInterval(() => {
          commandCount++;
          if (commandCount > maxCommands || !activeBots[socketId] || !bot) {
            clearInterval(sendCommandInterval);
            return;
          }
          
          console.log(`[Lobby Auto] Đang gửi lệnh chuyển cụm (Lần ${commandCount}/${maxCommands}): ${switchCommand}`);
          bot.physicsEnabled = false; // Tắt physics khi chuyển cụm
          try {
            bot.chat(switchCommand);
          } catch (e) {
            console.error('[Lobby Auto Command Error]:', e.message);
          }
        }, 4000);
        
        // Hủy interval khi bot đã chuyển cụm và spawn thành công ở cụm mới
        bot.once('spawn', () => {
          clearInterval(sendCommandInterval);
          console.log('[Lobby Auto] Đã chuyển cụm thành công bằng lệnh. Dừng gửi lệnh.');
        });
        return;
      }

      let lobbyCheckCount = 0;
      const maxLobbyChecks = 20; // Thử trong 40 giây (2s mỗi lần quét)
      let isWindowOpenRegistered = false;

      const clickSurvivalItem = async (window) => {
        try {
          const titleText = window.title ? chatToString(window.title, bot).toLowerCase() : '';
          console.log(`[Lobby Auto] Đang quét menu: "${titleText}"`);
          
          if (titleText.includes('chọn máy chủ') || titleText.includes('chọn cụm') || titleText.includes('máy chủ') || titleText.includes('cụm')) {
            // Chờ 500ms để đảm bảo các slots đã được đồng bộ đầy đủ từ server
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const getItemName = (item) => {
              if (!item) return '';
              
              const extractText = (val) => {
                if (!val) return '';
                if (typeof val === 'string') {
                  try {
                    const parsed = JSON.parse(val);
                    return chatToString(parsed, bot);
                  } catch (e) {
                    return val;
                  }
                }
                return chatToString(val, bot);
              };

              if (item.customName) {
                const str = extractText(item.customName);
                if (str) return String(str);
              }
              if (item.nbt && item.nbt.value && item.nbt.value.display && item.nbt.value.display.value && item.nbt.value.display.value.Name) {
                const str = extractText(item.nbt.value.display.value.Name.value);
                if (str) return String(str);
              }
              return String(item.displayName || item.name || '');
            };

            // Log ra tất cả các vật phẩm trong window để debug
            console.log('[Lobby Auto Debug] Danh sách vật phẩm trong menu:');
            window.slots.forEach((item, idx) => {
              if (item) {
                console.log(`  Slot ${idx}: name=${item.name}, cleanName="${getItemName(item)}"`);
              }
            });

            const customServerKeyword = (config.lobbyServer || '').trim().toLowerCase();
            const survivalItem = window.slots.find(item => {
              if (!item) return false;
              const cleanName = getItemName(item).toLowerCase();
              if (customServerKeyword) {
                const keywords = customServerKeyword.split(',').map(k => k.trim()).filter(Boolean);
                return keywords.some(k => cleanName.includes(k));
              }
              return cleanName.includes('survival chill') || cleanName.includes('survival') || cleanName.includes('sinh tồn');
            });

            if (survivalItem) {
              bot.hasSwitchedLobby = true; // Đánh dấu đã chuyển cụm sảnh
              console.log(`[Lobby Auto] Tìm thấy cụm máy chủ: "${getItemName(survivalItem)}". Tiến hành click slot ${survivalItem.slot}...`);
              bot.physicsEnabled = false;
              console.log('[Lobby Auto] Đã tạm thời tắt physics của bot để chuẩn bị chuyển cụm.');
              await bot.clickWindow(survivalItem.slot, 0, 0);
              console.log('[Lobby Auto] Click cụm máy chủ thành công. Dừng kiểm tra sảnh.');
              clearInterval(lobbyInterval);
              bot.removeListener('windowOpen', onWindowOpenEvent);
              return true;
            } else {
              console.log(`[Lobby Auto] Chưa tìm thấy cụm máy chủ matching "${customServerKeyword || 'survival/sinh tồn'}" trong các slots.`);
            }
          }
        } catch (err) {
          console.error('[Lobby Auto Click Error]:', err.message);
        }
        return false;
      };

      const onWindowOpenEvent = async (window) => {
        await clickSurvivalItem(window);
      };

      const lobbyInterval = setInterval(async () => {
        lobbyCheckCount++;
        if (lobbyCheckCount > maxLobbyChecks || !activeBots[socketId] || !bot || !bot.inventory) {
          clearInterval(lobbyInterval);
          bot.removeListener('windowOpen', onWindowOpenEvent);
          return;
        }

        try {
          // Tìm vật phẩm Chọn Cụm trong hòm đồ
          const customItemKeyword = (config.lobbyItem || '').trim().toLowerCase();
          const lobbyItem = bot.inventory.items().find(item => {
            if (!item) return false;
            const displayName = item.displayName ? item.displayName.toLowerCase() : '';
            const name = item.name ? item.name.toLowerCase() : '';
            if (customItemKeyword) {
              const keywords = customItemKeyword.split(',').map(k => k.trim()).filter(Boolean);
              return keywords.some(k => displayName.includes(k) || name.includes(k));
            }
            return displayName.includes('chọn cụm') || name.includes('star') || displayName.includes('máy chủ') || name.includes('compass');
          });

          if (!lobbyItem) {
            // Nếu qua 10 giây (5 lần quét) mà không thấy vật phẩm Chọn Cụm, có thể bot đã ở server chính
            if (lobbyCheckCount > 5) {
              clearInterval(lobbyInterval);
              bot.removeListener('windowOpen', onWindowOpenEvent);
            }
            return;
          }

          // Đăng ký sự kiện mở window nếu chưa đăng ký
          if (!isWindowOpenRegistered) {
            bot.on('windowOpen', onWindowOpenEvent);
            isWindowOpenRegistered = true;
          }

          // Nếu menu đã mở sẵn trước đó
          if (bot.currentWindow) {
            const success = await clickSurvivalItem(bot.currentWindow);
            if (success) return;
          }

          // Trang bị và kích hoạt vật phẩm Chọn Cụm
          console.log(`[Lobby Auto] Phát hiện vật phẩm: ${lobbyItem.displayName || lobbyItem.name}. Tiến hành cầm lên tay và nhấn chuột phải...`);
          await bot.equip(lobbyItem, 'hand');
          
          await new Promise(resolve => setTimeout(resolve, 500));
          bot.activateItem(false);
          console.log('[Lobby Auto] Đã click chuột phải vật phẩm Chọn Cụm.');

        } catch (err) {
          console.warn('[Lobby Auto Interval Warning]:', err.message);
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

    // Hàm xử lý lệnh chat/thì thầm từ người chơi
    async function handleChatCommand(username, message) {
      const msgLower = message.toLowerCase().trim();
      const { goals } = require('mineflayer-pathfinder');
      const player = bot.players[username];

      if (['lại đây', 'lai day', 'đến đây', 'den day', 'come', 'here'].includes(msgLower)) {
        if (!player || !player.entity) {
          bot.chat(`Không nhìn thấy bạn, ${username}!`);
          return;
        }
        bot.chat(`Đang đi tới chỗ của ${username}...`);
        try {
          bot.isSurvivalBusy = true; 
          await bot.pathfinder.goto(new goals.GoalFollow(player.entity, 1));
          bot.chat(`Đã tới chỗ ${username}!`);
        } catch (e) {
          bot.chat(`Lỗi di chuyển: ${e.message}`);
        } finally {
          bot.isSurvivalBusy = false;
        }
      } 
      else if (['đi theo', 'di theo', 'follow', 'theo tôi', 'theo toi'].includes(msgLower)) {
        if (!player || !player.entity) {
          bot.chat(`Không nhìn thấy bạn để đi theo, ${username}!`);
          return;
        }
        bot.chat(`Bắt đầu đi theo ${username}. Chat 'dừng' để hủy.`);
        try {
          bot.isSurvivalBusy = true;
          bot.pathfinder.setGoal(new goals.GoalFollow(player.entity, 2), true);
        } catch (e) {
          bot.chat(`Lỗi di chuyển: ${e.message}`);
          bot.isSurvivalBusy = false;
        }
      } 
      else if (['dừng lại', 'dừng', 'dung lai', 'dung', 'stop'].includes(msgLower)) {
        bot.chat(`Đã dừng các hành động.`);
        bot.isSurvivalBusy = false;
        try {
          bot.pathfinder.setGoal(null);
        } catch (e) {}
      }
      else if (['sinh tồn', 'sinh ton', 'survival'].includes(msgLower)) {
        if (bot.aiSurvivalEnabled) {
          stopSurvivalLoop(bot);
          bot.chat(`Đã TẮT chế độ tự sinh tồn.`);
          socket.emit('bot-chat', {
            sender: 'System',
            message: '❌ TẮT Chế độ AI Sinh Tồn v2',
            time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
          });
        } else {
          startSurvivalLoop(bot, socket);
          bot.chat(`Đã BẬT chế độ tự sinh tồn.`);
        }
      }
      else if (['tình trạng', 'tinh trang', 'status', 'info'].includes(msgLower)) {
        const pos = bot.entity.position;
        bot.chat(`Máu: ${bot.health || 20}/20 | Thức ăn: ${bot.food || 20}/20 | Tọa độ: X:${pos.x.toFixed(1)}, Y:${pos.y.toFixed(1)}, Z:${pos.z.toFixed(1)}`);
      }
      else if (['chặt cây', 'chat cay', 'chặt gỗ', 'chat go', 'chop'].includes(msgLower)) {
        bot.chat('Đang đi tìm cây để chặt...');
        const logBlock = bot.findBlock({
          matching: block => block && block.name.includes('_log'),
          maxDistance: 32
        });
        if (logBlock) {
          try {
            bot.isSurvivalBusy = true;
            await chopTree(bot, logBlock);
            bot.chat('Đã hoàn thành chặt cây!');
          } catch (e) {
            bot.chat(`Lỗi chặt cây: ${e.message}`);
          } finally {
            bot.isSurvivalBusy = false;
          }
        } else {
          bot.chat('Không tìm thấy cây nào trong bán kính 32m.');
        }
      }
      else if (['chế bàn', 'che ban', 'chế tạo bàn chế tạo', 'che tao ban che tao', 'craft table'].includes(msgLower)) {
        const mcData = require('minecraft-data')(bot.version);
        const inv = checkInventoryForSurvival(bot);
        if (inv.totalPlanks < 4 && inv.totalLogs > 0) {
          bot.chat('Thiếu ván gỗ, đang tự chế tạo ván gỗ từ gỗ khúc...');
          const logItem = bot.inventory.items().find(i => i.name.includes('_log'));
          if (logItem) {
            const plankName = logItem.name.replace('_log', '_planks');
            const plankItem = mcData.itemsByName[plankName];
            if (plankItem) {
              const recipe = bot.recipesFor(plankItem.id, null, 1, null)[0];
              if (recipe) await bot.craft(recipe, 1, null);
            }
          }
          Object.assign(inv, checkInventoryForSurvival(bot));
        }

        if (inv.totalPlanks >= 4) {
          bot.chat('Đang chế tạo Bàn chế tạo...');
          const tableItem = mcData.itemsByName['crafting_table'];
          if (tableItem) {
            const recipe = bot.recipesFor(tableItem.id, null, 1, null)[0];
            if (recipe) {
              await bot.craft(recipe, 1, null);
              bot.chat('Đã chế tạo xong Bàn chế tạo!');
            } else {
              bot.chat('Không tìm thấy công thức chế tạo bàn chế tạo.');
            }
          }
        } else {
          bot.chat(`Không đủ gỗ. Cần ít nhất 4 ván gỗ (hiện có: ${inv.totalPlanks}).`);
        }
      }
      else if (['đặt bàn', 'dat ban', 'đặt bàn chế tạo', 'dat ban che tao', 'place table'].includes(msgLower)) {
        const tableItem = bot.inventory.items().find(i => i.name === 'crafting_table');
        if (!tableItem) {
          bot.chat('Không có Bàn chế tạo trong túi đồ!');
          return;
        }

        bot.chat('Đang tìm vị trí thích hợp để đặt bàn chế tạo...');
        const botFloorPos = bot.entity.position.floored();
        const referenceBlock = bot.findBlock({
          matching: block => {
            if (!block || !block.position || block.name === 'air' || block.name === 'water' || block.name === 'lava' || block.name === 'crafting_table') return false;
            const distToFeet = block.position.distanceTo(botFloorPos.offset(0, -1, 0));
            if (distToFeet < 0.5) return false;
            const blockAbove = bot.blockAt(block.position.offset(0, 1, 0));
            if (!blockAbove) return false;
            const passable = ['air', 'snow', 'grass', 'fern', 'bush', 'flower', 'tall_grass'].some(name => blockAbove.name.includes(name));
            if (!passable) return false;
            const targetPos = block.position.offset(0, 1, 0);
            const dx = Math.abs(bot.entity.position.x - (targetPos.x + 0.5));
            const dz = Math.abs(bot.entity.position.z - (targetPos.z + 0.5));
            const dy = Math.abs(bot.entity.position.y - targetPos.y);
            if (dx < 0.7 && dz < 0.7 && dy < 1.8) return false;
            return true;
          },
          maxDistance: 4
        });

        if (referenceBlock) {
          try {
            bot.isSurvivalBusy = true;
            await bot.equip(tableItem, 'hand');
            const { Vec3 } = require('vec3');
            await bot.lookAt(referenceBlock.position.offset(0.5, 1.0, 0.5));
            await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
            bot.chat('Đã đặt bàn chế tạo xuống đất!');
          } catch (e) {
            bot.chat(`Lỗi đặt bàn: ${e.message}`);
          } finally {
            bot.isSurvivalBusy = false;
          }
        } else {
          bot.chat('Không tìm thấy khối đất trống thích hợp xung quanh.');
        }
      }
      else if (['chế cúp gỗ', 'che cup go', 'chế cúp', 'che cup', 'craft pickaxe'].includes(msgLower)) {
        const mcData = require('minecraft-data')(bot.version);
        const tableBlock = bot.findBlock({
          matching: block => block && block.name === 'crafting_table',
          maxDistance: 5
        });

        if (!tableBlock) {
          bot.chat('Không tìm thấy Bàn chế tạo nào đang đặt gần đây!');
          return;
        }

        const inv = checkInventoryForSurvival(bot);
        if (inv.totalPlanks < 3 || inv.totalSticks < 2) {
          bot.chat('Đang tự chế tạo thêm ván gỗ/que gỗ để đủ nguyên liệu...');
          if (inv.totalPlanks < 5 && inv.totalLogs > 0) {
            const logItem = bot.inventory.items().find(i => i.name.includes('_log'));
            if (logItem) {
              const plankName = logItem.name.replace('_log', '_planks');
              const plankItem = mcData.itemsByName[plankName];
              if (plankItem) {
                const recipe = bot.recipesFor(plankItem.id, null, 1, null)[0];
                if (recipe) await bot.craft(recipe, 1, null);
              }
            }
            Object.assign(inv, checkInventoryForSurvival(bot));
          }
          if (inv.totalSticks < 2 && inv.totalPlanks >= 2) {
            const stickItem = mcData.itemsByName['stick'];
            if (stickItem) {
              const recipe = bot.recipesFor(stickItem.id, null, 1, null)[0];
              if (recipe) await bot.craft(recipe, 1, null);
            }
            Object.assign(inv, checkInventoryForSurvival(bot));
          }
        }

        if (inv.totalPlanks >= 3 && inv.totalSticks >= 2) {
          bot.chat('Đang chế tạo Cúp gỗ bằng bàn chế tạo...');
          const toolItem = mcData.itemsByName['wooden_pickaxe'];
          if (toolItem) {
            const recipe = bot.recipesFor(toolItem.id, null, 1, tableBlock)[0];
            if (recipe) {
              try {
                bot.isSurvivalBusy = true;
                await bot.craft(recipe, 1, tableBlock);
                bot.chat('Đã chế tạo thành công Cúp gỗ!');
              } catch (e) {
                bot.chat(`Lỗi chế tạo: ${e.message}`);
              } finally {
                bot.isSurvivalBusy = false;
              }
            } else {
              bot.chat('Không tìm thấy công thức cúp gỗ.');
            }
          }
        } else {
          bot.chat(`Không đủ nguyên liệu! Cần 3 ván gỗ & 2 que gỗ (hiện có: ${inv.totalPlanks} ván, ${inv.totalSticks} que).`);
        }
      }
      else if (['thu hồi bàn', 'thu hoi ban', 'đập bàn', 'dap ban', 'break table'].includes(msgLower)) {
        const tableBlock = bot.findBlock({
          matching: block => block && block.name === 'crafting_table',
          maxDistance: 5
        });
        if (tableBlock) {
          bot.chat('Đang đập bàn chế tạo để thu hồi...');
          try {
            bot.isSurvivalBusy = true;
            const tool = bot.inventory.items().find(i => i.name.includes('_axe') || i.name.includes('_pickaxe'));
            if (tool) await bot.equip(tool, 'hand');
            await bot.dig(tableBlock);
            await new Promise(resolve => setTimeout(resolve, 200));
            await collectNearbyItems(bot);
            bot.chat('Đã thu hồi Bàn chế tạo!');
          } catch (e) {
            bot.chat(`Lỗi thu hồi: ${e.message}`);
          } finally {
            bot.isSurvivalBusy = false;
          }
        } else {
          bot.chat('Không tìm thấy bàn chế tạo nào xung quanh để đập.');
        }
      }
      else if (['nhặt block', 'nhat block', 'nhặt gỗ', 'nhat go', 'nhặt đồ', 'nhat do', 'nhặt', 'nhat', 'collect', 'pickup'].includes(msgLower)) {
        bot.chat('Đang quét và tự động nhặt các item rơi xung quanh...');
        try {
          bot.isSurvivalBusy = true;
          await collectNearbyItems(bot);
          bot.chat('Đã quét xong các item xung quanh!');
        } catch (e) {
          bot.chat(`Lỗi nhặt item: ${e.message}`);
        } finally {
          bot.isSurvivalBusy = false;
        }
      }
      else if (['làm cúp gỗ', 'lam cup go', 'auto pickaxe', 'cúp gỗ tự động', 'cup go tu dong'].includes(msgLower)) {
        bot.chat('Bắt đầu chuỗi hành động chế tạo Cúp gỗ tự động...');
        try {
          bot.isSurvivalBusy = true;
          const mcData = require('minecraft-data')(bot.version);
          let inv = checkInventoryForSurvival(bot);

          const virtualPlanks = inv.totalPlanks + (inv.totalLogs * 4);
          if (virtualPlanks < 9) {
            bot.chat('Không đủ gỗ để tự động làm! Hãy đi chặt cây thêm.');
            return;
          }

          if (inv.totalPlanks < 9 && inv.totalLogs > 0) {
            bot.chat('Đang tự chế tạo thêm ván gỗ...');
            const logItem = bot.inventory.items().find(i => i.name.includes('_log'));
            if (logItem) {
              const plankName = logItem.name.replace('_log', '_planks');
              const plankItem = mcData.itemsByName[plankName];
              if (plankItem) {
                const recipe = bot.recipesFor(plankItem.id, null, 1, null)[0];
                if (recipe) await bot.craft(recipe, Math.ceil((9 - inv.totalPlanks) / 4), null);
              }
            }
            inv = checkInventoryForSurvival(bot);
          }

          if (inv.totalSticks < 2 && inv.totalPlanks >= 2) {
            bot.chat('Đang tự chế tạo thêm que gỗ...');
            const stickItem = mcData.itemsByName['stick'];
            if (stickItem) {
              const recipe = bot.recipesFor(stickItem.id, null, 1, null)[0];
              if (recipe) await bot.craft(recipe, 1, null);
            }
            inv = checkInventoryForSurvival(bot);
          }

          if (inv.totalCraftingTables === 0 && inv.totalPlanks >= 4) {
            bot.chat('Đang tự chế tạo bàn chế tạo...');
            const tableItem = mcData.itemsByName['crafting_table'];
            if (tableItem) {
              const recipe = bot.recipesFor(tableItem.id, null, 1, null)[0];
              if (recipe) await bot.craft(recipe, 1, null);
            }
            inv = checkInventoryForSurvival(bot);
          }

          const tableItem = bot.inventory.items().find(i => i.name === 'crafting_table');
          if (!tableItem) {
            bot.chat('Lỗi: Không tìm thấy bàn chế tạo trong túi đồ.');
            return;
          }

          bot.chat('Đang tìm vị trí để đặt bàn chế tạo...');
          const botFloorPos = bot.entity.position.floored();
          const referenceBlock = bot.findBlock({
            matching: block => {
              if (!block || !block.position || block.name === 'air' || block.name === 'water' || block.name === 'lava' || block.name === 'crafting_table') return false;
              const distToFeet = block.position.distanceTo(botFloorPos.offset(0, -1, 0));
              if (distToFeet < 0.5) return false;
              const blockAbove = bot.blockAt(block.position.offset(0, 1, 0));
              if (!blockAbove) return false;
              const passable = ['air', 'snow', 'grass', 'fern', 'bush', 'flower', 'tall_grass'].some(name => blockAbove.name.includes(name));
              if (!passable) return false;
              const targetPos = block.position.offset(0, 1, 0);
              const dx = Math.abs(bot.entity.position.x - (targetPos.x + 0.5));
              const dz = Math.abs(bot.entity.position.z - (targetPos.z + 0.5));
              const dy = Math.abs(bot.entity.position.y - targetPos.y);
              if (dx < 0.7 && dz < 0.7 && dy < 1.8) return false;
              return true;
            },
            maxDistance: 4
          });

          if (!referenceBlock) {
            bot.chat('Không tìm thấy block đất rắn bên cạnh để đặt bàn chế tạo.');
            return;
          }

          await bot.equip(tableItem, 'hand');
          const { Vec3 } = require('vec3');
          await bot.lookAt(referenceBlock.position.offset(0.5, 1.0, 0.5));
          await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
          await new Promise(resolve => setTimeout(resolve, 800));

          const tableBlock = bot.findBlock({
            matching: block => block && block.name === 'crafting_table',
            maxDistance: 5
          });

          if (tableBlock && inv.totalPlanks >= 3 && inv.totalSticks >= 2) {
            bot.chat('Đang chế tạo cúp gỗ bằng bàn chế tạo...');
            const toolItem = mcData.itemsByName['wooden_pickaxe'];
            if (toolItem) {
              const recipe = bot.recipesFor(toolItem.id, null, 1, tableBlock)[0];
              if (recipe) await bot.craft(recipe, 1, tableBlock);
            }
          }

          if (tableBlock) {
            bot.chat('Đang thu hồi lại bàn chế tạo...');
            const tool = bot.inventory.items().find(i => i.name.includes('_axe') || i.name.includes('_pickaxe'));
            if (tool) await bot.equip(tool, 'hand');
            await bot.dig(tableBlock);
            await new Promise(resolve => setTimeout(resolve, 200));
            await collectNearbyItems(bot);
            bot.chat('Đã hoàn thành toàn bộ chuỗi chế tạo Cúp gỗ tự động!');
          }
        } catch (e) {
          bot.chat(`Lỗi chuỗi tự động: ${e.message}`);
        } finally {
          bot.isSurvivalBusy = false;
        }
      }
    }

    // 4. Nhận tin nhắn chat từ những người chơi khác
    bot.on('chat', (username, message) => {
      // Bỏ qua tin nhắn do chính bot gửi để tránh lặp
      if (username === bot.username) return;

      socket.emit('bot-chat', {
        sender: username,
        message: message,
        type: 'public',
        time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
      });

      handleChatCommand(username, message).catch(err => {
        console.error('[Chat Command Error]:', err.message);
      });
    });

    // Nhận tin nhắn thì thầm (whisper) từ người chơi khác
    bot.on('whisper', (username, message) => {
      if (username === bot.username) return;

      socket.emit('bot-chat', {
        sender: username,
        receiver: bot.username,
        message: message,
        type: 'private',
        time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
      });

      handleChatCommand(username, message).catch(err => {
        console.error('[Whisper Command Error]:', err.message);
      });
    });

    // 5. Nhận toàn bộ log tin nhắn thô (hệ thống, thông báo server...)
    bot.on('messagestr', (messageStr) => {
      if (!messageStr.trim()) return;
      
      // Ghi nhận tin nhắn game ra console log để lưu trữ và stream lên Discord Webhook
      console.log(`[Game Chat] ${messageStr.trim()}`);
      
      // Tự động kiểm tra và giải captcha nếu có
      checkAndSolveCaptcha(messageStr, bot);
      checkAndHandleAuth(messageStr, bot, password);

      // Quét yêu cầu TPA từ tin nhắn
      const tpaReq = parseTpaRequest(messageStr);
      if (tpaReq) {
        console.log(`[TPA] Phát hiện yêu cầu dịch chuyển (${tpaReq.type.toUpperCase()}) từ: ${tpaReq.sender}`);
        socket.emit('tpa-request', {
          sender: tpaReq.sender,
          type: tpaReq.type
        });

        if (bot.autoAcceptTpa) {
          setTimeout(() => {
            if (activeBots[socketId] === bot) {
              console.log(`[TPA] Tự động đồng ý TPA từ: ${tpaReq.sender}`);
              bot.chat(`/tpaccept ${tpaReq.sender}`);
            }
          }, 1000);
        }
      }

      const isNormalChat = messageStr.includes('<') && messageStr.includes('>');
      if (!isNormalChat) {
        const whisper = parseWhisperMessage(messageStr);
        if (whisper) {
          socket.emit('bot-chat', {
            sender: whisper.sender,
            receiver: whisper.receiver,
            message: whisper.message,
            type: 'private',
            time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
          });
        } else {
          const publicChat = parsePublicChatMessage(messageStr, bot.players);
          if (publicChat) {
            socket.emit('bot-chat', {
              prefix: publicChat.prefix,
              sender: publicChat.sender,
              message: publicChat.message,
              type: 'public',
              time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
            });
          } else {
            socket.emit('bot-chat', {
              sender: 'System',
              message: messageStr,
              type: 'system',
              time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
            });
          }
        }
      }
    });



    // 5.6. Lắng nghe tiêu đề (Title) để hiển thị Captcha hoặc thông tin từ server
    bot.on('title', (titleText, type) => {
      if (!titleText) return;
      const text = chatToString(titleText, bot);
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
      const text = chatToString(message, bot);
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
      const text = chatToString(bossBar.title, bot);
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
      const text = chatToString(bossBar.title, bot);
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

    // 5.5. Tự động chấp nhận resource pack của server để tránh bị kick
    bot.on('resourcePack', (url, hash) => {
      console.log(`[Bot] Nhận yêu cầu tải resource pack từ server: ${url}. Đang tự động chấp nhận...`);
      try {
        bot.acceptResourcePack();
      } catch (err) {
        console.error(`[Bot] Không thể tự động chấp nhận resource pack:`, err.message);
      }
    });

    // 6. Khi bot bị kick khỏi server
    bot.on('kicked', (reason) => {
      const parsedReason = parseKickReason(reason, bot);
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
      const errMsg = err ? (err.message || String(err)) : 'Không rõ lỗi';
      console.error(`[Bot] Lỗi kết nối bot: ${errMsg}`);
      handleBotDisconnect(`Lỗi kết nối: ${errMsg}`, true);
    });
  }

  // Nhận yêu cầu khởi tạo bot từ client
  socket.on('start-bot', (config) => {
    connectBot(config);
  });

  // Lắng nghe các lệnh điều khiển dịch chuyển TPA
  socket.on('tpa-send', (player) => {
    const bot = activeBots['default_bot'];
    if (bot && player) {
      console.log(`[Socket] Bot ${bot.username} gửi yêu cầu dịch chuyển tới: ${player}`);
      bot.chat(`/tpa ${player}`);
    }
  });

  socket.on('tpa-here-send', (player) => {
    const bot = activeBots['default_bot'];
    if (bot && player) {
      console.log(`[Socket] Bot ${bot.username} gửi yêu cầu kéo người chơi tới: ${player}`);
      bot.chat(`/tpahere ${player}`);
    }
  });

  socket.on('tpa-action', (data) => {
    const { action, sender } = data;
    const bot = activeBots['default_bot'];
    if (bot) {
      const targetStr = sender ? ` ${sender}` : '';
      if (action === 'accept') {
        console.log(`[Socket] Bot chấp nhận yêu cầu dịch chuyển từ:${targetStr}`);
        bot.chat(`/tpaccept${targetStr}`);
      } else if (action === 'deny') {
        console.log(`[Socket] Bot từ chối yêu cầu dịch chuyển từ:${targetStr}`);
        bot.chat(`/tpdeny${targetStr}`);
      }
    }
  });

  socket.on('toggle_tpa_auto', (state) => {
    const bot = activeBots['default_bot'];
    if (bot) {
      bot.autoAcceptTpa = state === true;
      console.log(`[Socket] Cập nhật tự động đồng ý TPA: ${bot.autoAcceptTpa}`);
      
      // Đồng thời cập nhật lại trong botConfigs để nếu kết nối lại sẽ giữ nguyên cấu hình này
      if (botConfigs['default_bot']) {
        botConfigs['default_bot'].autoAcceptTpa = bot.autoAcceptTpa;
      }
    }
  });

  // Lắng nghe bật/tắt các module hack từ client
  socket.on('toggle_module', (data) => {
    const { module: moduleName, state } = data;
    const bot = activeBots['default_bot'];
    if (!bot) {
      socket.emit('bot-status', { status: 'offline', message: 'Chờ bot kết nối để bật/tắt module!' });
      return;
    }

    console.log(`[Socket] Nhận lệnh toggle_module: ${moduleName} -> ${state}`);

    if (moduleName === 'killaura_dualwield') {
      bot.killauraDualWield = state;
      console.log(`[Killaura] Cập nhật trạng thái dualwield: ${state}`);
      return;
    }

    if (moduleName === 'killaura') {
      if (state) {
        // Tắt killaura cũ nếu đang chạy
        if (bot.killauraInterval) clearInterval(bot.killauraInterval);
        
        // Nhận thêm trạng thái dualwield lúc khởi tạo nếu được gửi kèm
        bot.killauraDualWield = data.dualwield !== false;
        
        console.log(`[Killaura] Đã BẬT module Killaura cho socket ${socket.id} (DualWield: ${bot.killauraDualWield})`);
        let currentTarget = null;

        bot.killauraInterval = setInterval(async () => {
          if (!bot.entity) return;
          
          // Tự động kiểm tra và ăn táo vàng/thức ăn ở off-hand nếu cần
          await eatOffhand(bot);
          if (bot.isEating) return;
          
          let candidatesCount = 0;
          const target = bot.nearestEntity((entity) => {
            if (!entity) return false;
            if (entity.isValid === false) return false;
            if (entity.id === bot.entity.id) return false;
            
            // Lọc thực thể sống (mobs/hostile/passive/player)
            const isLiving = (entity.type === 'mob') || 
                             (entity.type === 'hostile') || 
                             (entity.type === 'passive') || 
                             (entity.type === 'player');
            if (!isLiving) return false;

            // Loại bỏ động vật hiền/thụ động nếu không phải người chơi
            if (entity.type !== 'player') {
              const passiveMobs = [
                'cow', 'pig', 'sheep', 'chicken', 'rabbit', 'horse', 'donkey', 'mule', 
                'llama', 'villager', 'iron_golem', 'squid', 'glow_squid', 'bat', 'bee', 
                'cat', 'dog', 'wolf', 'fox', 'panda', 'parrot', 'polar_bear', 'strider', 
                'turtle', 'axolotl', 'frog', 'tadpole', 'camel', 'sniffer', 'cod', 
                'salmon', 'pufferfish', 'tropical_fish', 'ocelot', 'snow_golem', 'allay', 'armadillo'
              ];
              const name = (entity.name || '').toLowerCase();
              const isPassive = passiveMobs.some(m => name.includes(m));
              if (isPassive) return false;
            }

            if (!entity.position) return false;
            const dist = entity.position.distanceTo(bot.entity.position);
            
            // Log các mục tiêu hợp lệ gần bot trong bán kính 10m
            if (dist <= 10) {
              candidatesCount++;
              console.log(`[Killaura Target Close] Name=${entity.name}, Type=${entity.type}, ID=${entity.id}, Dist=${dist.toFixed(2)}m`);
            }

            return dist <= 15; // Quét tìm trong bán kính 15m để di chuyển tới
          });
          
          if (target && target.position) {
            // Tự động trang bị vũ khí trước khi tấn công hoặc di chuyển (hỗ trợ cầm 2 tay & thức ăn/táo vàng)
            try {
              const inventoryItems = bot.inventory.items();
              const weapons = inventoryItems.filter(item => item.name.includes('sword') || item.name.includes('_axe'));
              
              if (weapons.length > 0) {
                const sortedWeapons = weapons.sort((a, b) => getWeaponScore(b) - getWeaponScore(a));
                
                // --- 1. Trang bị tay chính (Main Hand) ---
                const mainDestSlot = typeof bot.getEquipmentDestSlot === 'function' ? bot.getEquipmentDestSlot('hand') : (36 + bot.quickBarSlot);
                const currentMainHand = bot.inventory.slots[mainDestSlot];
                if (!currentMainHand || currentMainHand.name !== sortedWeapons[0].name) {
                  await bot.equip(sortedWeapons[0], 'hand');
                }
                
                // --- 2. Trang bị tay phụ (Off-Hand) ---
                // Tìm kiếm theo độ ưu tiên: Totem > Second Weapon (nếu dualwield) > Shield > Táo vàng > Thức ăn khác
                const totem = inventoryItems.find(item => item.name === 'totem_of_undying');
                const shield = inventoryItems.find(item => item.name === 'shield');
                const gapple = inventoryItems.find(item => item.name === 'enchanted_golden_apple' || item.name === 'golden_apple');
                
                const foodNames = [
                  'golden_carrot', 'cooked_beef', 'cooked_porkchop', 'cooked_chicken',
                  'cooked_mutton', 'cooked_salmon', 'cooked_cod', 'cooked_rabbit', 'bread', 'baked_potato', 'carrot', 'apple'
                ];
                const generalFood = inventoryItems.find(item => foodNames.includes(item.name));
                
                let targetOffhandItem = null;
                
                if (totem) {
                  targetOffhandItem = totem;
                } else if (bot.killauraDualWield && sortedWeapons.length > 1) {
                  targetOffhandItem = sortedWeapons[1];
                } else if (shield) {
                  targetOffhandItem = shield;
                } else if (gapple) {
                  targetOffhandItem = gapple;
                } else if (generalFood) {
                  targetOffhandItem = generalFood;
                }
                
                // Thực hiện trang bị/thay thế tay phụ
                const offhandDestSlot = typeof bot.getEquipmentDestSlot === 'function' ? bot.getEquipmentDestSlot('off-hand') : 45;
                const currentOffHand = bot.inventory.slots[offhandDestSlot];
                
                if (targetOffhandItem) {
                  if (!currentOffHand || currentOffHand.name !== targetOffhandItem.name) {
                    await bot.equip(targetOffhandItem, 'off-hand');
                  }
                } else {
                  // Nếu không có gì và off-hand đang cầm vũ khí thì cất đi
                  if (currentOffHand && (currentOffHand.name.includes('sword') || currentOffHand.name.includes('_axe'))) {
                    await bot.unequip('off-hand');
                  }
                }
              }
            } catch (e) {
              console.warn('[Killaura Auto Weapon/Item Error]:', e.message);
            }

            const dist = target.position.distanceTo(bot.entity.position);
            
            // 1. Tấn công trực tiếp nếu mục tiêu nằm trong tầm đánh (4.5m)
            if (dist <= 4.5) {
              const targetPos = target.position.offset(0, target.height ? target.height * 0.75 : 1.0, 0);
              console.log(`[Killaura Action] TẤN CÔNG: Name=${target.name || target.type}, ID=${target.id}, Dist=${dist.toFixed(2)}m`);
              
              // Xoay đầu lập tức và thực hiện đòn đánh
              bot.lookAt(targetPos, true);
              bot.attack(target);
              
              // Vung tay phụ nếu đang cầm vũ khí ở cả 2 tay
              if (bot.killauraDualWield) {
                try {
                  const offhandDestSlot = typeof bot.getEquipmentDestSlot === 'function' ? bot.getEquipmentDestSlot('off-hand') : 45;
                  const currentOffHand = bot.inventory.slots[offhandDestSlot];
                  if (currentOffHand && (currentOffHand.name.includes('sword') || currentOffHand.name.includes('_axe'))) {
                    bot.swingArm('off-hand');
                  }
                } catch (e) {}
              }
            }
            
            // 2. Tự động di chuyển đuổi theo mục tiêu bằng Pathfinder
            if (!bot.aiSurvivalEnabled || !bot.isSurvivalBusy) {
              if (!currentTarget || currentTarget.id !== target.id) {
                currentTarget = target;
                console.log(`[Killaura Path] Thiết lập di chuyển đuổi theo: Name=${target.name || target.type}, ID=${target.id}`);
                
                try {
                  const mcData = require('minecraft-data')(bot.version);
                  const { Movements, goals } = require('mineflayer-pathfinder');
                  const defaultMovements = new Movements(bot, mcData);
                  defaultMovements.canDig = false; // Tránh bot tự phá block
                  bot.pathfinder.setMovements(defaultMovements);
                  
                  const isFlying = target.name === 'phantom' || target.name === 'ghast' || target.name === 'ender_dragon' || target.name === 'wither';
                  if (isFlying) {
                    // Với mục tiêu bay, di chuyển tới tọa độ X-Z trên mặt đất ngay dưới chân nó
                    bot.pathfinder.setGoal(new goals.GoalXZ(target.position.x, target.position.z), true);
                  } else {
                    // Với Người chơi & Quái vật đi bộ, đuổi sát mục tiêu (phạm vi 2.0m)
                    bot.pathfinder.setGoal(new goals.GoalFollow(target, 2), true);
                  }
                } catch (e) {
                  console.warn('[Killaura Pathfinder Error]:', e.message);
                }
              } else {
                const isFlying = target.name === 'phantom' || target.name === 'ghast' || target.name === 'ender_dragon' || target.name === 'wither';
                if (isFlying) {
                  // Cập nhật liên tục tọa độ đuổi theo quái vật đang bay
                  try {
                    const { goals } = require('mineflayer-pathfinder');
                    bot.pathfinder.setGoal(new goals.GoalXZ(target.position.x, target.position.z), true);
                  } catch (e) {}
                }
              }
            }
          } else {
            // Không tìm thấy mục tiêu nào trong bán kính 15m
            if (currentTarget) {
              console.log(`[Killaura Path] Mục tiêu ngoài bán kính 15m hoặc biến mất. Dừng di chuyển.`);
              currentTarget = null;
              if (!bot.aiSurvivalEnabled || !bot.isSurvivalBusy) {
                try {
                  bot.pathfinder.setGoal(null);
                } catch (e) {}
              }
            }
          }
        }, 400);
        
        socket.emit('bot-chat', {
          sender: 'System',
          message: '❌ BẬT Module Killaura (Tự động đuổi đánh Người chơi & Phantom)',
          time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
        });
      } else {
        if (bot.killauraInterval) {
          clearInterval(bot.killauraInterval);
          bot.killauraInterval = null;
          console.log(`[Killaura] Đã TẮT module Killaura cho socket ${socket.id}`);
        }
        if (!bot.aiSurvivalEnabled || !bot.isSurvivalBusy) {
          try {
            bot.pathfinder.setGoal(null);
          } catch (e) {}
        }
        if (bot.pvp) {
          try { bot.pvp.stop(); } catch (e) {}
        }
        socket.emit('bot-chat', {
          sender: 'System',
          message: '✔️ TẮT Module Killaura',
          time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
        });
      }
    } else if (moduleName === 'autoeat') {
      if (bot.autoEat) {
        if (state) {
          bot.autoEat.enableAuto();
          socket.emit('bot-chat', {
            sender: 'System',
            message: '❌ BẬT Module Auto-Eat',
            time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
          });
        } else {
          bot.autoEat.disableAuto();
          socket.emit('bot-chat', {
            sender: 'System',
            message: '✔️ TẮT Module Auto-Eat',
            time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
          });
        }
      } else {
        socket.emit('bot-chat', {
          sender: 'System',
          message: 'Lỗi: Plugin Auto-Eat chưa sẵn sàng',
          time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
        });
      }
    } else if (moduleName === 'autoarmor') {
      bot.autoArmorEnabled = state;
      if (state) {
        if (bot.armorManager) {
          bot.armorManager.equipAll().catch(() => {});
        }
        socket.emit('bot-chat', {
          sender: 'System',
          message: '❌ BẬT Module Auto-Armor',
          time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
        });
      } else {
        socket.emit('bot-chat', {
          sender: 'System',
          message: '✔️ TẮT Module Auto-Armor',
          time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
        });
      }
    } else if (moduleName === 'ai_survival') {
      bot.aiSurvivalEnabled = state;
      if (state) {
        startSurvivalLoop(bot, socket);
      } else {
        stopSurvivalLoop(bot);
        socket.emit('bot-chat', {
          sender: 'System',
          message: '✔️ TẮT Chế độ AI Sinh Tồn',
          time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
        });
      }
    }
  });

  // Lắng nghe lệnh gửi chat từ Frontend để bot phát ngôn
  socket.on('send-chat', (message) => {
    const bot = activeBots['default_bot'];
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

  // Lắng nghe yêu cầu di chuyển bot (setControlState) từ người dùng
  socket.on('bot-move', (data) => {
    const { direction, state } = data;
    const bot = activeBots['default_bot'];
    if (!bot) return;

    if (['forward', 'back', 'left', 'right', 'jump', 'sneak', 'sprint'].includes(direction)) {
      bot.setControlState(direction, state === true || state === 'true');
    }
  });

  // Lắng nghe yêu cầu xoay hướng nhìn bot từ người dùng
  socket.on('bot-rotate', (data) => {
    const { yawDelta, pitchDelta } = data;
    const bot = activeBots['default_bot'];
    if (!bot || !bot.entity) return;

    try {
      const currentYaw = bot.entity.yaw;
      const currentPitch = bot.entity.pitch;
      const newYaw = currentYaw + (yawDelta || 0);
      const newPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, currentPitch + (pitchDelta || 0)));
      bot.look(newYaw, newPitch, true);
    } catch (err) {
      console.error('[Bot] Lỗi khi xoay hướng nhìn:', err.message);
    }
  });

  // Lắng nghe cấu hình chế độ Sinh tồn tự động từ client
  socket.on('set_survival_config', (data) => {
    const { key, value } = data;
    const bot = activeBots['default_bot'];
    if (!bot) return;

    if (key === 'mining_target') {
      bot.miningTargetOre = value;
      console.log(`[AI Survival] Cấu hình loại quặng ưu tiên đào: ${value}`);
      socket.emit('bot-chat', {
        sender: 'System',
        message: `⛏️ Đã đổi mục tiêu khai thác thành: ${value === 'all' ? 'Tất cả quặng' : value}`,
        time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
      });
    }
  });

  // Lắng nghe yêu cầu dừng toàn bộ hoạt động bot (stop all)
  socket.on('bot-stop-all', () => {
    const bot = activeBots['default_bot'];
    if (!bot) return;

    try {
      // 1. Dừng mọi trạng thái di chuyển thủ công
      ['forward', 'back', 'left', 'right', 'jump', 'sneak', 'sprint'].forEach(dir => {
        bot.setControlState(dir, false);
      });

      // 2. Dừng di chuyển tự động (Pathfinder)
      if (bot.pathfinder) {
        try {
          bot.pathfinder.setGoal(null);
        } catch (e) {}
      }

      // 3. Dừng killaura nếu đang bật
      if (bot.killauraInterval) {
        clearInterval(bot.killauraInterval);
        bot.killauraInterval = null;
        // Đồng bộ trạng thái tắt killaura về frontend
        socket.emit('module_state_change', { module: 'killaura', state: false });
        socket.emit('bot-chat', {
          sender: 'System',
          message: '✔️ Đã tắt Killaura vì nhận lệnh Dừng (Stop).',
          time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
        });
      }

      // 4. Dừng PvP plugin
      if (bot.pvp) {
        try { bot.pvp.stop(); } catch (e) {}
      }

      // 5. Dừng chế độ AI Sinh tồn nếu đang bật
      if (bot.aiSurvivalEnabled) {
        bot.aiSurvivalEnabled = false;
        stopSurvivalLoop(bot);
        socket.emit('module_state_change', { module: 'ai_survival', state: false });
        socket.emit('bot-chat', {
          sender: 'System',
          message: '✔️ Đã tắt AI Sinh Tồn vì nhận lệnh Dừng (Stop).',
          time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
        });
      }

      console.log('[Bot] Đã dừng toàn bộ di chuyển, pathfinder, killaura và AI sinh tồn.');
    } catch (err) {
      console.error('[Bot] Lỗi khi thực hiện dừng toàn bộ:', err.message);
    }
  });

  // Lắng nghe yêu cầu thao tác hòm đồ (equip, use, drop) từ người dùng
  socket.on('inventory-action', async (data) => {
    const { slot, action } = data;
    const bot = activeBots['default_bot'];
    if (!bot || !bot.inventory) return;

    const item = bot.inventory.slots[slot];
    if (!item) return;

    console.log(`[Inventory Action] Socket yêu cầu hành động: ${action} trên slot ${slot} (${item.name})`);

    try {
      if (action === 'equip-hand') {
        await bot.equip(item, 'hand');
        socket.emit('bot-chat', {
          sender: 'System',
          message: `Đã cầm [${item.displayName || item.name}] trên tay chính.`,
          time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
        });
      } else if (action === 'equip-offhand') {
        await bot.equip(item, 'off-hand');
        socket.emit('bot-chat', {
          sender: 'System',
          message: `Đã cầm [${item.displayName || item.name}] trên tay phụ.`,
          time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
        });
      } else if (action === 'drop') {
        await bot.tossStack(item);
        socket.emit('bot-chat', {
          sender: 'System',
          message: `Đã vứt bỏ vật phẩm [${item.displayName || item.name}].`,
          time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
        });
      } else if (action === 'use') {
        // Cầm lên tay chính trước
        await bot.equip(item, 'hand');
        // Đợi 200ms
        await new Promise(r => setTimeout(r, 200));
        // Kích hoạt
        bot.activateItem(false);
        socket.emit('bot-chat', {
          sender: 'System',
          message: `Đã sử dụng vật phẩm [${item.displayName || item.name}].`,
          time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
        });
      }
    } catch (err) {
      console.error(`[Inventory Action Error]:`, err.message);
      socket.emit('bot-chat', {
        sender: 'System',
        message: `Lỗi thao tác hòm đồ: ${err.message}`,
        time: new Date().toLocaleTimeString('vi-VN', { hour12: false })
      });
    }
  });

  // Lắng nghe yêu cầu dừng bot thủ công từ người dùng
  socket.on('stop-bot', () => {
    const socketId = 'default_bot';
    
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
      console.log(`[Bot] Người dùng yêu cầu dừng bot.`);
      
      // Chủ động đóng viewer trước để giải phóng cổng 3001 ngay lập tức
      if (bot.viewer) {
        try {
          bot.viewer.close();
          console.log(`[Bot] Đã chủ động đóng viewer của ${socketId}`);
        } catch (e) {
          console.error('[Bot] Lỗi khi chủ động đóng viewer:', e.message);
        }
      }

      try {
        bot.end();
      } catch (err) {
        console.error('[Bot] Lỗi khi quit bot:', err.message);
      }
      io.emit('bot-status', { status: 'offline', message: 'Đã chủ động ngắt kết nối bot.' });
    }
  });

  // Khi người dùng đóng tab / ngắt kết nối Socket.io
  socket.on('disconnect', () => {
    console.log(`[Socket] Client ngắt kết nối: ${socket.id}`);
    // Không giải phóng bot khi client ngắt kết nối web để duy trì hoạt động liên tục
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
