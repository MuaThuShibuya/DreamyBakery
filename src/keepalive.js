'use strict';
/**
 * @file keepalive.js
 * @description Express HTTP server để giữ bot luôn hoạt động trên Render free tier.
 *
 * Vấn đề: Render free tier tự "ngủ" sau 15 phút không có traffic HTTP.
 *
 * Giải pháp:
 *  1. Chạy Express server trên port ${PORT} (Render yêu cầu web service có HTTP port)
 *  2. Nếu có RENDER_EXTERNAL_URL (chạy trên Render), self-ping /health mỗi 14 phút
 *     để không bao giờ đạt ngưỡng 15 phút không hoạt động
 *
 * Endpoint:
 *  GET /        → thông báo bot đang chạy (dùng cho UptimeRobot)
 *  GET /health  → JSON status (dùng cho Render healthcheck)
 */

const express = require('express');
const https   = require('https');
const http    = require('http');

/**
 * Khởi động Express keep-alive server và đăng ký self-ping nếu đang trên Render.
 */
function startKeepAlive() {
  const app  = express();
  const port = parseInt(process.env.PORT) || 10000;

  // ── Endpoints ─────────────────────────────────────────────────────────────

  /** Endpoint đơn giản cho UptimeRobot / monitoring tools */
  app.get('/', (_req, res) => {
    res.send('🍰 Tiệm Bánh Mộng Mơ đang hoạt động!');
  });

  /** Endpoint healthcheck cho Render — trả JSON với timestamp */
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', bot: 'Dreamy Bakery', timestamp: new Date().toISOString() });
  });

  app.listen(port, () => {
    console.log(`🌐 Keep-alive server đang chạy trên port ${port}`);
  });

  // ── Self-ping (chỉ trên Render) ───────────────────────────────────────────

  const externalUrl = process.env.RENDER_EXTERNAL_URL;
  if (externalUrl) {
    /**
     * Ping /health mỗi 14 phút để Render không tắt service.
     * Dùng https hoặc http tùy vào URL scheme.
     */
    const pingInterval = 14 * 60 * 1000; // 14 phút
    const requester    = externalUrl.startsWith('https') ? https : http;

    setInterval(() => {
      requester.get(`${externalUrl}/health`, (res) => {
        console.log(`🔄 Self-ping: HTTP ${res.statusCode}`);
      }).on('error', (err) => {
        console.warn('⚠️  Self-ping thất bại:', err.message);
      });
    }, pingInterval);

    console.log(`🔄 Self-ping đã đăng ký mỗi 14 phút → ${externalUrl}/health`);
  }
}

module.exports = { startKeepAlive };
