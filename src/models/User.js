'use strict';
/**
 * @file User.js
 * @description Mongoose schema và model cho người chơi.
 *
 * Cấu trúc dữ liệu:
 *  - userId + guildId: khóa chính (unique compound index)
 *  - inventory     : toàn bộ nguyên liệu và bánh (cả thường lẫn Thượng Hạng)
 *  - upgrades      : 4 loại nâng cấp, mỗi loại 0–5
 *  - bakingQueue   : hàng đợi lò nướng (mảng các BakingJob)
 *  - dailyOrders   : đơn hàng NPC hàng ngày, reset theo ngày
 *  - cooldowns     : timestamp hết hồi chiêu cho garden/farm/sneak
 *  - stats         : thống kê tổng hợp để hiển thị bảng xếp hạng và hồ sơ
 */

const mongoose = require('mongoose');

// ─── Sub-schemas ─────────────────────────────────────────────────────────────

/**
 * Một công việc đang nướng trong lò.
 * finishTime: thời điểm bánh xong, isShiny được roll ngay khi thêm vào queue.
 */
const bakingJobSchema = new mongoose.Schema({
  item:       { type: String,  required: true },
  quantity:   { type: Number,  required: true },
  finishTime: { type: Date,    required: true },
  isShiny:    { type: Boolean, default: false },
}, { _id: false });

/**
 * Một đơn hàng từ NPC.
 * completed: đánh dấu đã hoàn thành để không cho phép nộp lại.
 */
const npcOrderSchema = new mongoose.Schema({
  npcId:     { type: String, required: true },
  item:      { type: String, required: true },
  quantity:  { type: Number, required: true },
  reward:    { type: Number, required: true },   // Xu thưởng
  expReward: { type: Number, required: true },   // EXP thưởng
  completed: { type: Boolean, default: false },
  phrase:    { type: String },                   // Lời thoại đã sinh sẵn
}, { _id: false });

/**
 * Thú cưng của người chơi
 */
const petSchema = new mongoose.Schema({
  petKey: { type: String, required: true },
  name:   { type: String, required: true },
  level:  { type: Number, default: 1 },
  exp:    { type: Number, default: 0 },
  // Phẩm chất Sao (Tăng khi ăn bánh Thượng Hạng)
  stars:  { type: Number, default: 0 },
  // Chỉ số hiện tại (tăng theo cấp và khi cho ăn bánh)
  stats:  { hp: Number, atk: Number, def: Number, spd: Number },
  // Kỹ năng đã học
  skills: { type: [String], default: [] },
  // Đặc tính (Trait)
  trait: {
    id: { type: String, default: null },
    level: { type: Number, default: 1 }
  },
  // Trang bị
  equipment: {
    weapon: { type: String, default: null },
    head:   { type: String, default: null },
    armor:  { type: String, default: null },
    accessory: { type: String, default: null }
  }
}); // Có _id tự động để phân biệt các con pet trùng loại

// ─── Inventory schema ─────────────────────────────────────────────────────────

/**
 * Định nghĩa tất cả slot inventory với default = 0.
 * Dùng schema tường minh thay vì Mixed để Mongoose theo dõi thay đổi đúng cách.
 */
const invSchema = new mongoose.Schema({
  // Nguyên liệu vườn
  wheat: { type: Number, default: 0, min: 0 },
  strawberry: { type: Number, default: 0, min: 0 },
  rose: { type: Number, default: 0, min: 0 },
  // Nguyên liệu trang trại
  milk: { type: Number, default: 0, min: 0 },
  egg: { type: Number, default: 0, min: 0 },
  butter: { type: Number, default: 0, min: 0 },
  // Nguyên liệu chợ
  chocolate: { type: Number, default: 0, min: 0 },
  vanilla: { type: Number, default: 0, min: 0 },
  goldpowder: { type: Number, default: 0, min: 0 },
  
  // Bánh thường
  strawberry_cupcake: { type: Number, default: 0, min: 0 },
  butter_croissant:   { type: Number, default: 0, min: 0 },
  chocolate_donut:    { type: Number, default: 0, min: 0 },
  macaroon:           { type: Number, default: 0, min: 0 },
  cheesecake:         { type: Number, default: 0, min: 0 },
  rose_cake:          { type: Number, default: 0, min: 0 },
  layered_cake:       { type: Number, default: 0, min: 0 },
  golden_pastry:      { type: Number, default: 0, min: 0 },

  // Bánh Thượng Hạng (shiny)
  shiny_strawberry_cupcake: { type: Number, default: 0, min: 0 },
  shiny_butter_croissant:   { type: Number, default: 0, min: 0 },
  shiny_chocolate_donut:    { type: Number, default: 0, min: 0 },
  shiny_macaroon:           { type: Number, default: 0, min: 0 },
  shiny_cheesecake:         { type: Number, default: 0, min: 0 },
  shiny_rose_cake:          { type: Number, default: 0, min: 0 },
  shiny_layered_cake:       { type: Number, default: 0, min: 0 },
  shiny_golden_pastry:      { type: Number, default: 0, min: 0 },
}, { _id: false });

// ─── User Schema ─────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema({
  /** Discord User ID */
  userId:  { type: String, required: true },
  /** Discord Guild (Server) ID — dữ liệu tách biệt theo server */
  guildId: { type: String, required: true },
  /** Tên hiển thị, cập nhật mỗi lần tương tác */
  username: { type: String, default: 'Ẩn danh' },

  /** Xu vàng hiện có */
  coins: { type: Number, default: 100 },
  /** Tổng điểm EXP (dùng calcLevel() để tính cấp độ) */
  exp:   { type: Number, default: 0 },

  /** Máu của người chơi (dùng cho lệnh chọi bánh !nem) */
  hp:    { type: Number, default: 100 },

  /** Thời điểm hồi HP lần cuối */
  lastHpUpdate: { type: Date, default: Date.now },

  /** Số tiền nợ (vay từ admin) */
  debt:  { type: Number, default: 0 },

  /** Quyền Chủ Shop (Được DEV cấp phép) */
  isShopOwner: { type: Boolean, default: false },

  /** Quyền Tự Bơm Tiền (Được DEV cấp phép) */
  canSpawnCoins: { type: Boolean, default: false },

  /** Tinh thể (Crystals for traits) */
  crystals: { type: Number, default: 0 },

  /** Pity Gacha */
  gachaPitySSS: { type: Number, default: 0 },
  gachaPitySSSP: { type: Number, default: 0 },

  /** Kho trang bị thú cưng */
  gears: { type: Map, of: Number, default: {} },

  /** Kho sách kỹ năng */
  skillBooks: { type: Map, of: Number, default: {} },

  /** Danh sách thú cưng đang sở hữu */
  pets: {
    type: [petSchema],
    default: []
  },
  /** ID của thú cưng đang theo sau (Active Pet) */
  activePetId: { type: mongoose.Schema.Types.ObjectId, default: null },

  /** Kho vật phẩm của người chơi */
  inventory: {
    type:    invSchema,
    default: () => ({}),
  },

  /** Các cấp nâng cấp tiệm bánh */
  upgrades: {
    oven:   { type: Number, default: 0 }, // Lò nướng
    decor:  { type: Number, default: 0 }, // Trang trí tiệm
    garden: { type: Number, default: 0 }, // Khu vườn
    farm:   { type: Number, default: 0 }, // Trang trại
  },

  /** Hàng đợi lò nướng (tối đa 5 job song song) */
  bakingQueue: { type: [bakingJobSchema], default: [] },

  /** Đơn hàng NPC hàng ngày */
  dailyOrders:     { type: [npcOrderSchema], default: [] },
  /** Ngày tạo dailyOrders — dùng để kiểm tra cần reset chưa */
  dailyOrdersDate: { type: Date, default: null },

  /**
   * Timestamps hết hồi chiêu.
   * null hoặc thời điểm trong quá khứ = đã sẵn sàng.
   */
  cooldowns: {
    garden: { type: Date, default: null },
    farm:   { type: Date, default: null },
    sneak:  { type: Date, default: null },
    pet_force: { type: Date, default: null },
    boss:   { type: Date, default: null },
    daily:  { type: Date, default: null },
  },

  /** Thống kê tổng hợp (dùng cho bảng xếp hạng và hồ sơ) */
  stats: {
    totalBaked:  { type: Number, default: 0 }, // Tổng số bánh đã nướng
    totalSold:   { type: Number, default: 0 }, // Tổng số bánh đã bán
    totalOrders: { type: Number, default: 0 }, // Tổng đơn NPC hoàn thành
    totalGifts:  { type: Number, default: 0 }, // Tổng số lần tặng quà
    totalSneaks: { type: Number, default: 0 }, // Tổng số lần đi trộm
    pvpWins:     { type: Number, default: 0 }, // Tổng số trận thắng Đấu Pet
    pvpLosses:   { type: Number, default: 0 }, // Tổng số trận thua Đấu Pet
    highestBP:   { type: Number, default: 0 }, // Lực chiến cao nhất
  },

  /** Hệ thống PvP (3 lần / 1 tiếng) & Tháp SAO */
  pvpCount:   { type: Number, default: 0 },
  pvpTime:    { type: Date, default: null },
  towerFloor: { type: Number, default: 1 },
  dungeonStage: { type: Number, default: 1 },

  /** Trạng thái cấm sử dụng bot (Admin set bằng /admin ban) */
  banned:    { type: Boolean, default: false },
  banReason: { type: String,  default: ''    },

  createdAt: { type: Date, default: Date.now },
});

// ─── Indexes ─────────────────────────────────────────────────────────────────

/** Khóa chính: mỗi user chỉ có 1 document mỗi server */
userSchema.index({ userId: 1, guildId: 1 }, { unique: true });
/** Index cho bảng xếp hạng theo xu */
userSchema.index({ guildId: 1, coins: -1 });
/** Index cho bảng xếp hạng theo EXP */
userSchema.index({ guildId: 1, exp: -1 });
/** Index cho bảng xếp hạng theo số bánh đã nướng */
userSchema.index({ guildId: 1, 'stats.totalBaked': -1 });
/** Index cho bảng xếp hạng theo Lực Chiến */
userSchema.index({ guildId: 1, 'stats.highestBP': -1 });

// ─── Middleware / Hooks ──────────────────────────────────────────────────────

userSchema.post(['findOne', 'findOneAndUpdate'], function(doc) {
  if (!doc || typeof doc.save !== 'function') return;
  const now = new Date();
  
  if (!doc.lastHpUpdate) {
    doc.lastHpUpdate = now;
    doc.constructor.updateOne({ _id: doc._id }, { $set: { lastHpUpdate: now } }).catch(() => {});
    return;
  }
  
  const REGEN_RATE_MS = 3 * 60 * 1000; // 3 phút hồi 1 HP
  const diff = now.getTime() - doc.lastHpUpdate.getTime();
  const hpToRecover = Math.floor(diff / REGEN_RATE_MS);
  
  if (hpToRecover > 0 && doc.hp < 100) {
    const newHp = Math.min(100, doc.hp + hpToRecover);
    const newLastHpUpdate = newHp === 100 ? now : new Date(doc.lastHpUpdate.getTime() + hpToRecover * REGEN_RATE_MS);
    doc.hp = newHp;
    doc.lastHpUpdate = newLastHpUpdate;
    doc.constructor.updateOne({ _id: doc._id }, { $set: { hp: newHp, lastHpUpdate: newLastHpUpdate } }).catch(() => {});
  } else if (doc.hp >= 100 && diff > REGEN_RATE_MS) {
    doc.lastHpUpdate = now;
    doc.constructor.updateOne({ _id: doc._id }, { $set: { lastHpUpdate: now } }).catch(() => {});
  }
});

module.exports = mongoose.model('User', userSchema);
