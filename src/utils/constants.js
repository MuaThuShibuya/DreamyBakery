'use strict';
/**
 * @file constants.js
 * @description Tất cả hằng số game của Tiệm Bánh Mộng Mơ.
 *
 * Bao gồm:
 *  - INGREDIENTS   : Nguyên liệu (vườn, trang trại, chợ)
 *  - BAKED_GOODS   : Bánh và công thức nấu
 *  - MARKET_PRICES : Giá mua/bán tại chợ NPC
 *  - NPCS          : Các nhân vật NPC đặt hàng hàng ngày
 *  - NPC_PHRASES   : Template lời thoại ngẫu nhiên của NPC
 *  - UPGRADES      : 4 loại nâng cấp tiệm bánh
 *  - GARDEN/FARM_HARVEST : Phạm vi sản lượng thu hoạch
 *  - COOLDOWNS     : Thời gian hồi chiêu (ms)
 *  - LEVEL_TITLES  : Danh hiệu theo cấp độ
 *  - COLORS        : Mã màu cho Discord Embeds
 */

// ─── Nguyên liệu ─────────────────────────────────────────────────────────────

/**
 * Tất cả nguyên liệu trong game.
 * source: 'garden' | 'farm' | 'market'
 */
const INGREDIENTS = {
  wheat:       { name: 'Lúa Mì',         emoji: '🌾', source: 'garden' },
  strawberry:  { name: 'Dâu Tây',        emoji: '🍓', source: 'garden' },
  rose:        { name: 'Hoa Hồng',       emoji: '🌹', source: 'garden' },
  milk:        { name: 'Sữa Tươi',       emoji: '🥛', source: 'farm'   },
  egg:         { name: 'Trứng Gà',       emoji: '🥚', source: 'farm'   },
  butter:      { name: 'Bơ',            emoji: '🧈', source: 'farm'   },
  chocolate:   { name: 'Chocolate',      emoji: '🍫', source: 'market' },
  vanilla:     { name: 'Tinh Chất Vani', emoji: '🫙', source: 'market' },
  goldpowder:  { name: 'Bột Vàng',       emoji: '✨', source: 'market' },
};

// ─── Bánh và công thức ───────────────────────────────────────────────────────

/**
 * Tất cả loại bánh có thể nướng.
 * @property {Object} recipe      - Nguyên liệu cần thiết { itemKey: quantity }
 * @property {number} bakeTime    - Thời gian nướng (phút, trước khi tính bonus lò)
 * @property {number} basePrice   - Giá bán thường (xu)
 * @property {number} shinyPrice  - Giá bán phiên bản Thượng Hạng (xu)
 * @property {number} shinyChance - Tỉ lệ ra Thượng Hạng (0–1)
 */
const BAKED_GOODS = {
  strawberry_cupcake: {
    name: 'Cupcake Dâu',           emoji: '🧁',
    recipe: { wheat: 2, strawberry: 3, milk: 1, egg: 1 },
    bakeTime: 0, basePrice: 50, shinyPrice: 150, shinyChance: 0.05,
    description: 'Cupcake ngọt ngào với dâu tây tươi mọng',
  },
  butter_croissant: {
    name: 'Croissant Bơ',          emoji: '🥐',
    recipe: { wheat: 3, butter: 2, egg: 1 },
    bakeTime: 0, basePrice: 45, shinyPrice: 135, shinyChance: 0.05,
    description: 'Bánh sừng bò giòn rụm thơm mùi bơ',
  },
  chocolate_donut: {
    name: 'Donut Chocolate',       emoji: '🍩',
    recipe: { wheat: 2, milk: 1, egg: 1, chocolate: 2 },
    bakeTime: 0, basePrice: 80, shinyPrice: 240, shinyChance: 0.05,
    description: 'Donut ngọt ngào phủ chocolate đậm đà',
  },
  macaroon: {
    name: 'Macaroon Sắc Màu',      emoji: '🫧',
    recipe: { egg: 3, vanilla: 1, strawberry: 2, rose: 1 },
    bakeTime: 12, basePrice: 120, shinyPrice: 360, shinyChance: 0.06,
    description: 'Bánh macaroon nhiều màu sắc, ngọt như mơ',
  },
  cheesecake: {
    name: 'Cheesecake Vani',       emoji: '🍰',
    recipe: { wheat: 3, milk: 4, egg: 2, vanilla: 1 },
    bakeTime: 15, basePrice: 150, shinyPrice: 450, shinyChance: 0.06,
    description: 'Cheesecake mịn màng với hương vani dịu nhẹ',
  },
  rose_cake: {
    name: 'Bánh Hoa Hồng',         emoji: '🌹',
    recipe: { wheat: 4, rose: 3, milk: 2, egg: 3, butter: 1 },
    bakeTime: 25, basePrice: 180, shinyPrice: 540, shinyChance: 0.07,
    description: 'Bánh tinh tế trang trí bằng hoa hồng thật',
  },
  layered_cake: {
    name: 'Bánh Kem 3 Tầng',       emoji: '🎂',
    recipe: { wheat: 5, milk: 3, egg: 4, butter: 2, strawberry: 2 },
    bakeTime: 20, basePrice: 200, shinyPrice: 600, shinyChance: 0.08,
    description: 'Bánh kem đặc biệt với 3 tầng ngọt ngào',
  },
  golden_pastry: {
    name: 'Bánh Vàng Huyền Thoại', emoji: '⭐',
    recipe: { wheat: 5, goldpowder: 2, egg: 3, butter: 2, vanilla: 1 },
    bakeTime: 30, basePrice: 350, shinyPrice: 1050, shinyChance: 0.10,
    description: 'Bánh ngàn vàng, chỉ đầu bếp tài ba mới làm được',
  },
};

// ─── Giá chợ NPC ─────────────────────────────────────────────────────────────

/**
 * Giá mua và bán tại chợ thị trấn.
 * Bánh nướng bán theo công thức: basePrice * 0.7 (tính trong market.js).
 */
const MARKET_PRICES = {
  chocolate:  { buy: 30,  sell: 15  },
  vanilla:    { buy: 50,  sell: 25  },
  goldpowder: { buy: 200, sell: 100 },
  wheat:      { buy: 8,   sell: 3   },
  strawberry: { buy: 10,  sell: 4   },
  rose:       { buy: 12,  sell: 5   },
  milk:       { buy: 10,  sell: 4   },
  egg:        { buy: 8,   sell: 3   },
  butter:     { buy: 15,  sell: 6   },
};

// ─── NPC ─────────────────────────────────────────────────────────────────────

/** Danh sách nhân vật NPC xuất hiện trong đơn hàng hàng ngày. */
const NPCS = [
  { id: 'bunny',     name: 'Cô Thỏ Bông',    emoji: '🐰' },
  { id: 'fox',       name: 'Chàng Cáo Cam',  emoji: '🦊' },
  { id: 'bear',      name: 'Gấu Bông Mập',   emoji: '🐻' },
  { id: 'butterfly', name: 'Nàng Bướm',      emoji: '🦋' },
  { id: 'fairy',     name: 'Tiên Hoa',       emoji: '🌸' },
  { id: 'cat',       name: 'Mèo Trà Sữa',    emoji: '🐱' },
  { id: 'owl',       name: 'Cú Mèo Sao',     emoji: '🦉' },
];

/**
 * Template lời thoại NPC khi đặt hàng.
 * Mỗi function nhận (npc, itemStr, qty) và trả về chuỗi.
 */
const NPC_PHRASES = [
  (npc, itemStr, qty) => `${npc.emoji} **${npc.name}** thỏ thẻ: *"Ừm... cậu có thể làm cho mình **${qty}** cái **${itemStr}** không? 🥺"*`,
  (npc, itemStr, qty) => `${npc.emoji} **${npc.name}** ghé thăm: *"Này! Mình cần **${qty}** **${itemStr}** ngay! Đang có khách đặt tiệc mà! ✨"*`,
  (npc, itemStr, qty) => `${npc.emoji} **${npc.name}** rụt rè hỏi: *"Xin lỗi vì làm phiền... Tiệm có **${qty}** **${itemStr}** không ạ? >///<"*`,
  (npc, itemStr, qty) => `${npc.emoji} **${npc.name}** vui vẻ đến: *"Hôm nay trời đẹp quá! Cho mình **${qty}** **${itemStr}** nhé 🌸"*`,
];

// ─── Hệ thống Thú Cưng & PvP ──────────────────────────────────────────────────

/** Trọng số chỉ số gốc theo Hạng (Rank) */
const PET_RANKS = {
  B:   { multiplier: 1.0, color: '⚪' },
  A:   { multiplier: 1.5, color: '🟢' },
  S:   { multiplier: 2.5, color: '🔵' },
  SS:  { multiplier: 4.0, color: '🟣' },
  SSS: { multiplier: 7.0, color: '🟡' },
  'SSS+': { multiplier: 12.0, color: '🔴' },
};

/** Danh sách 23 Thú Cưng (Hạng B đến SSS) */
const PETS = {
  // Rank B (Thú cưng cơ bản)
  slime:       { name: 'Slime Nước',   emoji: '💧', rank: 'B', baseStats: { hp: 50, atk: 10, def:  5, spd:  5 } },
  caterpillar: { name: 'Sâu Róm',      emoji: '🐛', rank: 'B', baseStats: { hp: 45, atk: 12, def:  3, spd:  8 } },
  mushroom:    { name: 'Nấm Lùn',      emoji: '🍄', rank: 'B', baseStats: { hp: 60, atk:  8, def: 10, spd:  2 } },
  mouse:       { name: 'Chuột Nhắt',   emoji: '🐭', rank: 'B', baseStats: { hp: 30, atk: 15, def:  2, spd: 15 } },
  turtle:      { name: 'Rùa Đồng',     emoji: '🐢', rank: 'B', baseStats: { hp: 80, atk:  5, def: 15, spd:  1 } },
  frog:        { name: 'Ếch Xanh',     emoji: '🐸', rank: 'B', baseStats: { hp: 40, atk: 12, def:  5, spd: 20 } },
  snail:       { name: 'Ốc Sên',       emoji: '🐌', rank: 'B', baseStats: { hp: 90, atk:  4, def: 20, spd:  1 } },
  // Rank A (Thú cưng hoang dã)
  wolf:        { name: 'Chó Sói',      emoji: '🐺', rank: 'A', baseStats: { hp: 70, atk: 25, def: 10, spd: 15 } },
  wildcat:     { name: 'Mèo Rừng',     emoji: '🐱', rank: 'A', baseStats: { hp: 50, atk: 30, def:  5, spd: 20 } },
  fox:         { name: 'Cáo Đỏ',       emoji: '🦊', rank: 'A', baseStats: { hp: 60, atk: 20, def:  8, spd: 25 } },
  boar:        { name: 'Lợn Rừng',     emoji: '🐗', rank: 'A', baseStats: { hp: 90, atk: 22, def: 15, spd:  8 } },
  panda:       { name: 'Gấu Trúc',     emoji: '🐼', rank: 'A', baseStats: { hp:100, atk: 15, def: 20, spd:  5 } },
  deer:        { name: 'Hươu Sao',     emoji: '🦌', rank: 'A', baseStats: { hp: 80, atk: 18, def: 12, spd: 28 } },
  monkey:      { name: 'Khỉ Nâu',      emoji: '🐒', rank: 'A', baseStats: { hp: 65, atk: 25, def:  8, spd: 30 } },
  // Rank S (Thú cưng linh thú)
  fire_fox:    { name: 'Hỏa Hồ Ly',    emoji: '🔥', rank: 'S', baseStats: { hp:120, atk: 45, def: 20, spd: 35 } },
  ice_wolf:    { name: 'Sói Băng',     emoji: '❄️', rank: 'S', baseStats: { hp:150, atk: 40, def: 25, spd: 30 } },
  treant:      { name: 'Mộc Tinh',     emoji: '🌳', rank: 'S', baseStats: { hp:200, atk: 20, def: 40, spd: 10 } },
  earth_dragon:{ name: 'Rồng Đất',     emoji: '🦎', rank: 'S', baseStats: { hp:180, atk: 35, def: 35, spd: 15 } },
  fairy:       { name: 'Yêu Tinh',     emoji: '🧚', rank: 'S', baseStats: { hp: 90, atk: 50, def: 15, spd: 40 } },
  griffin:     { name: 'Điểu Sư',      emoji: '🦅', rank: 'S', baseStats: { hp:130, atk: 48, def: 22, spd: 45 } },
  thunder_bird:{ name: 'Lôi Điểu',     emoji: '⚡', rank: 'S', baseStats: { hp:110, atk: 55, def: 18, spd: 50 } },
  // Rank SS (Thần thú)
  phoenix:     { name: 'Phượng Hoàng', emoji: '🦚', rank: 'SS',baseStats: { hp:250, atk: 80, def: 40, spd: 60 } },
  unicorn:     { name: 'Kỳ Lân',       emoji: '🦄', rank: 'SS',baseStats: { hp:300, atk: 60, def: 60, spd: 50 } },
  white_tiger: { name: 'Bạch Hổ',      emoji: '🐅', rank: 'SS',baseStats: { hp:220, atk:100, def: 30, spd: 70 } },
  black_turtle:{ name: 'Huyền Vũ',     emoji: '🐢', rank: 'SS',baseStats: { hp:400, atk: 40, def:100, spd: 20 } },
  pegasus:     { name: 'Thiên Mã',     emoji: '🐎', rank: 'SS',baseStats: { hp:280, atk: 75, def: 45, spd: 90 } },
  cerberus:    { name: 'Khuyển Ngục',  emoji: '🐕‍🦺', rank: 'SS',baseStats: { hp:350, atk: 85, def: 55, spd: 40 } },
  // Rank SSS (Cổ đại - Tối thượng)
  dark_dragon: { name: 'Hắc Long',     emoji: '🐉', rank: 'SSS',baseStats:{ hp:500, atk:150, def: 80, spd: 90 } },
  leviathan:   { name: 'Leviathan',    emoji: '🐋', rank: 'SSS',baseStats:{ hp:800, atk: 90, def:120, spd: 50 } },
  ninetails:   { name: 'Cửu Vĩ Hồ',    emoji: '🦊', rank: 'SSS',baseStats:{ hp:400, atk:180, def: 60, spd:120 } },
  angel:       { name: 'Thiên Thần',   emoji: '👼', rank: 'SSS',baseStats:{ hp:600, atk:120, def:100, spd:100 } },
  bahamut:     { name: 'Bahamut',      emoji: '🐲', rank: 'SSS',baseStats:{ hp:750, atk:200, def: 90, spd: 60 } },
  valkyrie:    { name: 'Valkyrie',     emoji: '🛡️', rank: 'SSS',baseStats:{ hp:550, atk:160, def:110, spd:110 } },
  // Rank SSS+ (Cực hiếm - 0.1%)
  cosmic_dragon: { name: 'Thần Long Vũ Trụ', emoji: '🌌', rank: 'SSS+', baseStats: { hp:1200, atk: 300, def: 150, spd: 150 } },
  sun_god:       { name: 'Thần Mặt Trời',    emoji: '☀️', rank: 'SSS+', baseStats: { hp:1000, atk: 350, def: 120, spd: 160 } },
  moon_goddess:  { name: 'Nữ Thần Mặt Trăng',emoji: '🌙', rank: 'SSS+', baseStats: { hp:1100, atk: 320, def: 130, spd: 140 } },
  void_walker:   { name: 'Chúa Tể Hư Không', emoji: '🕳️', rank: 'SSS+', baseStats: { hp:1500, atk: 280, def: 200, spd: 100 } },
};

// ─── Nâng cấp ────────────────────────────────────────────────────────────────

/**
 * 4 loại nâng cấp tiệm bánh, mỗi loại tối đa 5 cấp.
 * costs[n] = chi phí để lên cấp n (costs[0] = 0, không dùng).
 */
const UPGRADES = {
  oven: {
    name: 'Lò Nướng', emoji: '🔥',
    description: 'Giảm thời gian nướng bánh',
    maxLevel: 5,
    costs: [0, 500, 1000, 2000, 4000, 8000],
    effect:        (lvl) => `Giảm ${lvl * 10}% thời gian nướng`,
    timeReduction: (lvl) => 1 - lvl * 0.10,
  },
  decor: {
    name: 'Trang Trí Tiệm', emoji: '🌸',
    description: 'Thu hút thêm khách NPC mỗi ngày',
    maxLevel: 5,
    costs: [0, 300, 600, 1200, 2400, 4800],
    effect:       (lvl) => `+${lvl} đơn NPC mỗi ngày`,
    bonusOrders:  (lvl) => lvl,
  },
  garden: {
    name: 'Khu Vườn', emoji: '🌿',
    description: 'Thu hoạch được nhiều nguyên liệu hơn',
    maxLevel: 5,
    costs: [0, 400, 800, 1600, 3200, 6400],
    effect:       (lvl) => `+${lvl * 20}% sản lượng vườn`,
    harvestBonus: (lvl) => 1 + lvl * 0.20,
  },
  farm: {
    name: 'Trang Trại', emoji: '🏡',
    description: 'Thu hoạch nhiều nguyên liệu trang trại hơn',
    maxLevel: 5,
    costs: [0, 400, 800, 1600, 3200, 6400],
    effect:       (lvl) => `+${lvl * 20}% sản lượng trang trại`,
    harvestBonus: (lvl) => 1 + lvl * 0.20,
  },
};

// ─── Thu hoạch ───────────────────────────────────────────────────────────────

/** Phạm vi sản lượng khi thu hoạch khu vườn (trước bonus nâng cấp). */
const GARDEN_HARVEST = {
  wheat:      { min: 3, max: 7 },
  strawberry: { min: 2, max: 5 },
  rose:       { min: 1, max: 3 },
};

/** Phạm vi sản lượng khi thu hoạch trang trại (trước bonus nâng cấp). */
const FARM_HARVEST = {
  milk:   { min: 2, max: 5 },
  egg:    { min: 3, max: 7 },
  butter: { min: 1, max: 3 },
};

// ─── Hồi chiêu (milliseconds) ────────────────────────────────────────────────

/** Thời gian hồi chiêu của các hành động chính (đơn vị: ms). */
const COOLDOWNS = {
  garden: 5 * 60 * 1000,       // 5 phút
  farm:   10 * 60 * 1000,      // 10 phút
  sneak:  2  * 60 * 60 * 1000, // 2 giờ
};

// ─── Hệ thống cấp độ ─────────────────────────────────────────────────────────

/**
 * Danh hiệu theo ngưỡng cấp độ.
 * Tra cứu bằng cách tìm entry cuối cùng có min <= currentLevel.
 */
const LEVEL_TITLES = [
  { min: 1,  title: '🌱 Học Viên Bánh'          },
  { min: 6,  title: '🥐 Thợ Bánh Tập Sự'       },
  { min: 11, title: '🧁 Đầu Bếp Bánh'          },
  { min: 21, title: '🎂 Bếp Trưởng'            },
  { min: 31, title: '🌟 Nghệ Nhân Bánh'        },
  { min: 51, title: '✨ Huyền Thoại Tiệm Bánh' },
];

// ─── Màu sắc Embed ───────────────────────────────────────────────────────────

/** Mã màu hex dùng cho Discord Embeds. Tông pastel nhẹ nhàng. */
const COLORS = {
  primary: 0xFFB7C5, // Hồng anh đào
  success: 0xA8E6CF, // Xanh bạc hà
  error:   0xFF8B94, // Đỏ nhẹ
  warning: 0xFFE66D, // Vàng kem
  gold:    0xFFD700, // Vàng kim
  purple:  0xDDA0DD, // Tím mận
};

// ─── Derived key lists (để import nhanh) ─────────────────────────────────────

/** Tất cả key nguyên liệu */
const INGR_KEYS  = Object.keys(INGREDIENTS);
/** Tất cả key bánh thường */
const BAKED_KEYS = Object.keys(BAKED_GOODS);
/** Tất cả key bánh Thượng Hạng */
const SHINY_KEYS = BAKED_KEYS.map(k => `shiny_${k}`);
/** Tất cả item key gộp lại */
const ALL_ITEM_KEYS = [...INGR_KEYS, ...BAKED_KEYS, ...SHINY_KEYS];

module.exports = {
  INGREDIENTS, BAKED_GOODS, MARKET_PRICES, NPCS, NPC_PHRASES,
  PETS, PET_RANKS,
  UPGRADES, GARDEN_HARVEST, FARM_HARVEST, COOLDOWNS,
  LEVEL_TITLES, COLORS, BAKED_KEYS, SHINY_KEYS, INGR_KEYS, ALL_ITEM_KEYS,
};
