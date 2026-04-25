'use strict';
const mongoose = require('mongoose');

const adminLogSchema = new mongoose.Schema({
  adminId:   { type: String, required: true },
  adminName: { type: String, required: true },
  guildId:   { type: String, required: true },
  action:    { type: String, required: true }, // VD: GIVE, COINS, BAN
  targetId:  { type: String, default: null },
  details:   { type: String, required: true }, // VD: Tặng 500 lúa mì
  createdAt: { type: Date, default: Date.now, expires: 30 * 24 * 3600 }, // Tự xóa sau 30 ngày
});

module.exports = mongoose.model('AdminLog', adminLogSchema);