'use strict';
/**
 * @file deploy-commands.js
 * @description Script đăng ký Slash Commands lên Discord API.
 *
 * Chạy một lần sau khi thêm / sửa lệnh:
 *   node deploy-commands.js
 *
 * Lưu ý:
 *  - Đăng ký global (ApplicationCommands) — áp dụng cho TẤT CẢ server.
 */

require('dotenv').config();
const { REST, Routes } = require('discord.js');
const path = require('path');
const fs   = require('fs');

// ─── Thu thập định nghĩa lệnh ────────────────────────────────────────────────

const commands     = [];
const commandsDir  = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const cmd = require(path.join(commandsDir, file));
  if (cmd.data) {
    commands.push(cmd.data.toJSON());
    console.log(`  📋 Đã thêm: /${cmd.data.name}`);
  }
}

// ─── Gửi lên Discord REST API ────────────────────────────────────────────────

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Trích xuất Client ID trực tiếp từ Token (phần đầu tiên mã hóa base64)
const clientId = Buffer.from(process.env.DISCORD_TOKEN.split('.')[0], 'base64').toString();

(async () => {
  try {
    console.log(`\n🔄 Đang đăng ký ${commands.length} lệnh lên Discord...\n`);

    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands },
    );

    console.log(`\n✅ Đã đăng ký ${commands.length} lệnh thành công!`);
    console.log('⏳ Lệnh global có thể mất đến 1 giờ để hiển thị ở mọi server.');
  } catch (err) {
    console.error('❌ Lỗi khi đăng ký lệnh:', err);
    process.exit(1);
  }
})();
