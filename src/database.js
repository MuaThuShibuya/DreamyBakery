'use strict';
/**
 * @file database.js
 * @description Kết nối MongoDB qua Mongoose với logging và tự động reconnect.
 *
 * Cấu hình:
 *  - MONGODB_URI lấy từ biến môi trường (.env)
 *  - serverSelectionTimeoutMS: 10s — nếu không kết nối được sau 10s thì báo lỗi
 *  - heartbeatFrequencyMS: 30s — ping định kỳ để giữ kết nối alive
 *
 * Mongoose tự động reconnect khi mất kết nối nên không cần xử lý thêm.
 */

const mongoose = require('mongoose');

/**
 * Khởi tạo kết nối MongoDB.
 * Đăng ký event listeners để log trạng thái kết nối.
 * @throws {Error} Nếu không thể kết nối sau timeout
 */
async function connectDB() {
  // Đăng ký listeners trước khi connect để bắt được mọi event
  mongoose.connection.on('connected',    () => console.log('🌸 MongoDB đã kết nối thành công!'));
  mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB mất kết nối, đang thử lại...'));
  mongoose.connection.on('error',        err => console.error('❌ MongoDB lỗi:', err.message));

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
    heartbeatFrequencyMS:     30_000,
  });
}

module.exports = { connectDB };
