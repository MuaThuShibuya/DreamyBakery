'use strict';
/**
 * @file gameUtils.js
 * @description Các hàm tiện ích cho logic game của Tiệm Bánh Mộng Mơ.
 *
 * Bao gồm:
 *  - Tra cứu thông tin vật phẩm (getItemInfo)
 *  - Tính toán công thức bánh (maxCanMake, getAvailableRecipes)
 *  - Định dạng thời gian (formatMs)
 *  - Hệ thống cấp độ / EXP (expForLevel, calcLevel, levelProgress)
 *  - Giao diện thanh tiến trình (progressBar)
 *  - Sinh đơn hàng NPC ngẫu nhiên (generateNpcOrders)
 *  - Tiện ích chung (randomInt, isNewDay, chunkArray)
 */

const { INGREDIENTS, BAKED_GOODS, NPCS, NPC_PHRASES, LEVEL_TITLES } = require('./constants');

// ─── Tra cứu vật phẩm ────────────────────────────────────────────────────────

/**
 * Tra cứu thông tin đầy đủ của một vật phẩm theo key.
 * Hỗ trợ cả nguyên liệu, bánh thường và bánh Thượng Hạng (shiny_*).
 *
 * @param {string} key - itemKey (VD: 'wheat', 'layered_cake', 'shiny_cheesecake')
 * @returns {{ name, emoji, type, key, ...}} | null nếu không tìm thấy
 */
function getItemInfo(key) {
  if (INGREDIENTS[key])  return { ...INGREDIENTS[key],  type: 'ingredient', key };
  if (BAKED_GOODS[key])  return { ...BAKED_GOODS[key],  type: 'baked',      key };

  if (key.startsWith('shiny_')) {
    const base = key.slice(6); // bỏ prefix 'shiny_'
    if (BAKED_GOODS[base]) {
      return {
        ...BAKED_GOODS[base],
        name:    `✨ ${BAKED_GOODS[base].name} (Thượng Hạng)`,
        type:    'shiny',
        key,
        baseKey: base,
      };
    }
  }
  return null;
}

// ─── Tính toán công thức bánh ─────────────────────────────────────────────────

/**
 * Tính số lượng tối đa có thể làm từ inventory hiện tại cho một công thức.
 * @param {Object} inv    - user.inventory (plain object hoặc Mongoose subdoc)
 * @param {Object} recipe - BAKED_GOODS[key].recipe
 * @returns {number} Số lượng tối đa (0 nếu không đủ nguyên liệu)
 */
function maxCanMake(inv, recipe) {
  let max = Infinity;
  for (const [ing, qty] of Object.entries(recipe)) {
    max = Math.min(max, Math.floor((inv[ing] || 0) / qty));
  }
  return max === Infinity ? 0 : max;
}

/**
 * Trả về danh sách các công thức user có thể nướng ngay (maxQty >= 1).
 * @param {Object} inv - user.inventory
 * @returns {Array<{ key, maxQty, ...BakedGoodData }>}
 */
function getAvailableRecipes(inv) {
  return Object.entries(BAKED_GOODS)
    .map(([key, data]) => ({ key, ...data, maxQty: maxCanMake(inv, data.recipe) }))
    .filter(r => r.maxQty > 0);
}

// ─── Định dạng thời gian ─────────────────────────────────────────────────────

/**
 * Định dạng milliseconds thành chuỗi thời gian thân thiện.
 * VD: 3661000 → "1g 1p", 90000 → "1p 30s", 5000 → "5s"
 * @param {number} ms
 * @returns {string}
 */
function formatMs(ms) {
  if (ms <= 0) return 'Sẵn sàng! ✅';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}g ${m}p`;
  if (m > 0) return `${m}p ${s}s`;
  return `${s}s`;
}

// ─── Hệ thống cấp độ / EXP ───────────────────────────────────────────────────

/**
 * Tổng EXP cần thiết để đạt cấp `lvl`.
 * Công thức: 100 * lvl * (lvl+1) / 2 (tăng lũy tiến)
 * @param {number} lvl
 * @returns {number}
 */
function expForLevel(lvl) {
  return Math.floor(100 * lvl * (lvl + 1) / 2);
}

/**
 * Tính cấp độ hiện tại từ tổng EXP.
 * @param {number} exp
 * @returns {number}
 */
function calcLevel(exp) {
  let lvl = 1;
  while (expForLevel(lvl) <= exp) lvl++;
  return Math.max(1, lvl - 1); // Tối thiểu cấp 1 dù EXP = 0
}

/**
 * Tính tiến độ EXP trong cấp hiện tại.
 * @param {number} exp - Tổng EXP của user
 * @param {number} lvl - Cấp hiện tại (kết quả từ calcLevel)
 * @returns {{ progress, needed, pct }} - EXP hiện tại trong cấp, cần để lên cấp, phần trăm
 */
function levelProgress(exp, lvl) {
  const prev     = lvl > 1 ? expForLevel(lvl - 1) : 0;
  const next     = expForLevel(lvl);
  const progress = exp - prev;
  const needed   = next - prev;
  return { progress, needed, pct: Math.min(100, Math.floor((progress / needed) * 100)) };
}

// ─── Giao diện ───────────────────────────────────────────────────────────────

/**
 * Tạo thanh tiến trình bằng emoji.
 * @param {number} pct - Phần trăm (0–100)
 * @param {number} [len=12] - Độ dài thanh
 * @returns {string} VD: "🟣🟣🟣🟣⬜⬜⬜⬜"
 */
function progressBar(pct, len = 12) {
  const fill = Math.round((pct / 100) * len);
  return '🟣'.repeat(fill) + '⬜'.repeat(len - fill);
}

/**
 * Lấy danh hiệu tương ứng với cấp độ.
 * @param {number} lvl
 * @returns {string}
 */
function getLevelTitle(lvl) {
  const entry = [...LEVEL_TITLES].reverse().find(t => lvl >= t.min);
  return entry ? entry.title : LEVEL_TITLES[0].title;
}

// ─── Sinh đơn hàng NPC ───────────────────────────────────────────────────────

/**
 * Tạo danh sách đơn hàng NPC ngẫu nhiên cho ngày mới.
 * Số lượng đơn = 3 (base) + decorLevel (bonus từ nâng cấp Trang Trí).
 *
 * @param {number} decorLevel - Cấp nâng cấp Trang Trí (user.upgrades.decor)
 * @returns {Array<NpcOrder>}
 */
function generateNpcOrders(decorLevel) {
  const count    = 3 + (decorLevel || 0);
  const orders   = [];
  const goodsKeys = Object.keys(BAKED_GOODS);
  const usedNpcs = new Set();

  for (let i = 0; i < count; i++) {
    // Ưu tiên không lặp NPC trong cùng ngày
    let npc;
    const available = NPCS.filter(n => !usedNpcs.has(n.id));
    npc = available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : NPCS[Math.floor(Math.random() * NPCS.length)];
    usedNpcs.add(npc.id);

    const itemKey   = goodsKeys[Math.floor(Math.random() * goodsKeys.length)];
    const itemData  = BAKED_GOODS[itemKey];
    const qty       = randomInt(1, 3);
    const reward    = Math.floor(itemData.basePrice * qty * (1.2 + Math.random() * 0.4));
    const expReward = Math.floor(reward / 3);
    const phrase    = NPC_PHRASES[Math.floor(Math.random() * NPC_PHRASES.length)](
      npc, `${itemData.emoji} ${itemData.name}`, qty,
    );

    orders.push({ npcId: npc.id, item: itemKey, quantity: qty, reward, expReward, completed: false, phrase });
  }
  return orders;
}

// ─── Tiện ích chung ───────────────────────────────────────────────────────────

/**
 * Trả về số nguyên ngẫu nhiên trong đoạn [min, max] (inclusive).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Kiểm tra xem `date` có thuộc ngày hôm qua hay trước đó không (để reset daily data).
 * @param {Date|null} date - Ngày cần kiểm tra
 * @returns {boolean} true nếu cần reset (ngày mới)
 */
function isNewDay(date) {
  if (!date) return true;
  return new Date(date).toDateString() !== new Date().toDateString();
}

/**
 * Chia mảng thành các mảng con có độ dài tối đa `size`.
 * Dùng để chia buttons thành nhiều ActionRow (max 5 nút/row).
 * @param {Array} arr
 * @param {number} size
 * @returns {Array<Array>}
 */
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

module.exports = {
  getItemInfo, maxCanMake, getAvailableRecipes,
  formatMs, expForLevel, calcLevel, levelProgress,
  progressBar, getLevelTitle, randomInt, isNewDay,
  generateNpcOrders, chunkArray,
};
