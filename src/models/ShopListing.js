'use strict';
/**
 * @file ShopListing.js
 * @description Mongoose schema cho listing trong cửa hàng người chơi.
 *
 * Đặc điểm:
 *  - Mỗi listing lưu thông tin người bán, item, số lượng, giá
 *  - TTL index tự động xóa listing sau 7 ngày (MongoDB TTL feature)
 *  - isShiny: phân biệt bánh thường và Thượng Hạng trong cùng collection
 *  - guildId: đảm bảo mỗi server có shop riêng biệt
 */

const mongoose = require('mongoose');

const shopListingSchema = new mongoose.Schema({
  /** Discord User ID của người bán */
  sellerId:   { type: String, required: true },
  /** Tên hiển thị của người bán tại thời điểm đăng */
  sellerName: { type: String, required: true },
  /** Discord Guild ID — shop chỉ hiển thị trong cùng server */
  guildId:    { type: String, required: true },
  /** Item key (VD: 'strawberry_cupcake', 'shiny_layered_cake') */
  item:       { type: String, required: true },
  /** Phân biệt bánh Thượng Hạng để hiển thị đúng emoji */
  isShiny:    { type: Boolean, default: false },
  /** Số lượng đang rao bán */
  quantity:   { type: Number, required: true, min: 1 },
  /** Giá mỗi cái (xu) */
  price:      { type: Number, required: true, min: 1 },
  /**
   * Thời điểm tạo listing.
   * expires: 604800 giây (7 ngày) — MongoDB TTL sẽ tự xóa document sau khoảng thời gian này.
   */
  createdAt:  { type: Date, default: Date.now, expires: 7 * 24 * 3600 },
});

// ─── Indexes ─────────────────────────────────────────────────────────────────

/** Lấy danh sách listing của server theo thứ tự mới nhất */
shopListingSchema.index({ guildId: 1, createdAt: -1 });
/** Lấy tất cả listing của một người bán (để giới hạn số listing active) */
shopListingSchema.index({ sellerId: 1, guildId: 1 });

module.exports = mongoose.model('ShopListing', shopListingSchema);
