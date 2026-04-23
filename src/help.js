'use strict';
/**
 * @file help.js
 * @description Lệnh /help — Hiển thị danh sách lệnh và hướng dẫn cơ bản.
 */

const { SlashCommandBuilder } = require('discord.js');
const { bakeryEmbed, row, btn } = require('../utils/embeds');
const { COLORS } = require('../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('helpbakery')
    .setDescription('🌸 Xem hướng dẫn và danh sách các lệnh của Tiệm Bánh'),

  /** Chạy khi người dùng gõ !helpbakery */
  async executeMessage(message, args) {
    const embed = bakeryEmbed(
      '📖 Sổ Tay Hướng Dẫn Tiệm Bánh Mộng Mơ',
      [
        `> *Chào mừng bạn đến với thế giới làm bánh ngọt ngào nhất Discord!* 🍰`,
        '',
        ` **Bảng Điều Khiển Trung Tâm (Khuyên Dùng)**`,
        `\`!menu\` (hoặc \`/menu\`) — Mở siêu ứng dụng quản lý toàn bộ Tiệm Bánh, Nông Trại, Cửa Hàng, Thú Cưng và PvP!`,
        '',
        `**🌿 Sản Xuất & Kinh Doanh (Lệnh Tắt)**`,
        `\`!garden\` / \`!farm\` — Thu hoạch nguyên liệu`,
        `\`!bake\` / \`!oven\` / \`!cookbook\` — Quản lý nướng bánh`,
        `\`!market\` / \`!order\` / \`!shop\` — Giao dịch & Kiếm xu`,
        '',
        `**🐾 Thú Cưng & Xã Hội**`,
        `\`!pet\` — 🥚 Ấp trứng và cường hóa Thú cưng (MỚI)`,
        `\`!sneak\` / \`!nem\` — ⚔️ Trộm vườn và chọi bánh PvP`,
        `\`!gift\` / \`!chuyentien\` — 🎁 Tặng quà & chuyển xu`,
        `\`!eat\` — 🍰 Ăn bánh để hồi HP`,
        '',
        `**👤 Hồ Sơ & Ngân Hàng**`,
        `\`!profile\` / \`!inventory\` / \`!upgrade\` / \`!top\` — Quản lý tài khoản`,
        `\`!vay thongtin\` / \`!vay tra <số_tiền>\` — 🏦 Tín dụng`,
        '',
        `**🔧 Hệ Thống (Chỉ DEV)**`,
        `\`!admin\` — Quản trị server, cấp quyền \`!shop\``,
      ].join('\n'),
      COLORS.purple
    ).setFooter({ 
      text: 'Tiệm Bánh Mộng Mơ (Official Bot) - Chúc bạn chơi game vui vẻ!',
      iconURL: message.client.user.displayAvatarURL()
    });

    const buttons = row(
      btn('menu:home', '📱 Mở Menu', 'Success'),
      btn('cookbook:open', '📖 Sổ Tay Công Thức', 'Primary'),
      btn('profile:open',  '🌸 Hồ Sơ Của Bạn', 'Secondary')
    );
    await message.reply({ embeds: [embed], components: [buttons] });
  },

  /** Chạy khi người dùng gõ /helpbakery */
  async execute(interaction) {
    const embed = bakeryEmbed(
      '📖 Sổ Tay Hướng Dẫn Tiệm Bánh Mộng Mơ',
      [
        `> *Chào mừng bạn đến với thế giới làm bánh ngọt ngào nhất Discord!* 🍰`,
        '',
        `📱 **Bảng Điều Khiển Trung Tâm (Khuyên Dùng)**`,
        `\`!menu\` (hoặc \`/menu\`) — Mở siêu ứng dụng quản lý toàn bộ Tiệm Bánh, Nông Trại, Cửa Hàng, Thú Cưng và PvP!`,
        '',
        `**🌿 Sản Xuất & Kinh Doanh (Lệnh Tắt)**`,
        `\`!garden\` / \`!farm\` — Thu hoạch nguyên liệu`,
        `\`!bake\` / \`!oven\` / \`!cookbook\` — Quản lý nướng bánh`,
        `\`!market\` / \`!order\` / \`!shop\` — Giao dịch & Kiếm xu`,
        '',
        `** Thú Cưng & Xã Hội**`,
        `\`!pet\` — 🥚 Ấp trứng và cường hóa Thú cưng (MỚI)`,
        `\`!sneak\` / \`!nem\` — ⚔️ Trộm vườn và chọi bánh PvP`,
        `\`!gift\` / \`!chuyentien\` — 🎁 Tặng quà & chuyển xu`,
        `\`!eat\` — 🍰 Ăn bánh để hồi HP`,
        '',
        `**👤 Hồ Sơ & Ngân Hàng**`,
        `\`!profile\` / \`!inventory\` / \`!upgrade\` / \`!top\` — Quản lý tài khoản`,
        `\`!vay thongtin\` / \`!vay tra <số_tiền>\` — 🏦 Tín dụng`,
        '',
        `**🔧 Hệ Thống (Chỉ DEV)**`,
        `\`!admin\` — Quản trị server, cấp quyền \`!shop\``,
      ].join('\n'),
      COLORS.purple
    ).setFooter({ 
      text: 'Tiệm Bánh Mộng Mơ (Official Bot) - Chúc bạn chơi game vui vẻ!',
      iconURL: interaction.client.user.displayAvatarURL()
    });

    // Thêm các nút lối tắt
    const buttons = row(
      btn('menu:home', '📱 Mở Menu', 'Success'),
      btn('cookbook:open', '📖 Sổ Tay Công Thức', 'Primary'),
      btn('profile:open',  '🌸 Hồ Sơ Của Bạn', 'Secondary')
    );

    await interaction.reply({ embeds: [embed], components: [buttons] });
  },
};