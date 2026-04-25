'use strict';
/**
 * @file Guild.js
 * @description Mongoose schema lưu trữ cấu hình riêng của từng server (Guild).
 */

const mongoose = require('mongoose');

const guildSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  /** Danh sách ID các kênh được phép dùng bot (rỗng = cho phép mọi kênh) */
  allowedChannels: { type: [String], default: [] },
});

module.exports = mongoose.model('Guild', guildSchema);