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

  async executeMessage(message, args) {
    const embed = bakeryEmbed(
      '📖 Sổ Tay Hướng Dẫn Tiệm Bánh Mộng Mơ',
      [
        `> *Chào mừng bạn đến với thế giới làm bánh ngọt ngào nhất Discord!* 🍰`,
        '',
        `**🌿 Nông Trại & Nguyên Liệu**`,
        `\`.garden\` — 🌾 Thu hoạch lúa mỳ, dâu tây, hoa hồng`,
        `\`.farm\` — 🐄 Thu hoạch sữa, trứng, bơ`,
        '',
        `**🔥 Bếp Nướng & Công Thức**`,
        `\`.cookbook\` — 📖 Xem sổ tay các loại bánh và nguyên liệu cần thiết`,
        `\`.bake\` — 🧁 Bắt đầu nướng bánh trong lò`,
        `\`.oven\` — 🔥 Xem hàng đợi của lò và lấy bánh đã nướng xong`,
        '',
        `**🏪 Kinh Doanh & Giao Lưu**`,
        `\`.order\` — 📋 Giao bánh cho khách NPC để nhận Xu & EXP`,
        `\`.shop\` — 🏬 Mở chợ người chơi để mua bán bánh và nguyên liệu`,
        `\`.gift\` — 🎁 Tặng quà cho người chơi khác`,
        `\`.sneak\` — 🐾 Lén trộm đồ của tiệm bánh khác`,
        '',
        `**👤 Hồ Sơ & Nâng Cấp**`,
        `\`.profile\` — 🌸 Xem cấp độ, danh hiệu và thành tích của bạn`,
        `\`.inventory\` — 📦 Xem kho chứa nguyên liệu và bánh`,
        `\`.upgrade\` — ⬆️ Nâng cấp thiết bị`,
        `\`.top\` — 🏆 Xem bảng xếp hạng toàn server`,
        '',
        `**🏦 Ngân Hàng & Tín Dụng**`,
        `\`.chuyentien @user <số_tiền>\` — 💸 Chuyển xu cho người chơi khác`,
        `\`.vay thongtin\` — 💳 Xem khoản nợ ngân hàng hiện tại của bạn`,
        `\`.vay tra <số_tiền>\` — 💸 Trả nợ ngân hàng`,
        '',
        `**🔧 Admin**`,
        `\`.admin\` — Xem các lệnh hệ thống (thêm/trừ xu: \`.admin coins\`)`,
        `\`.vay @user <số_tiền> <lãi_suất>\` — 🏦 (Admin) Cho user vay tiền`,
        `\`.bomtien <số_lượng>\` — 💸 (Dev) Tự bơm tiền vào tài khoản`,
        `\`.admin setchannel add #kênh\` — ⚙️ (Dev) Khóa bot chỉ trả lời ở kênh nhất định`,
      ].join('\n'),
      COLORS.purple
    ).setFooter({ 
      text: 'Tiệm Bánh Mộng Mơ (Official Bot) - Chúc bạn chơi game vui vẻ!',
      iconURL: message.client.user.displayAvatarURL()
    });

    const buttons = row(
      btn('cookbook:open', '📖 Sổ Tay Công Thức', 'Primary'),
      btn('profile:open',  '🌸 Hồ Sơ Của Bạn', 'Secondary')
    );

    await message.reply({ embeds: [embed], components: [buttons] });
  },

  async execute(interaction) {
    const embed = bakeryEmbed(
      '📖 Sổ Tay Hướng Dẫn Tiệm Bánh Mộng Mơ',
      [
        `> *Chào mừng bạn đến với thế giới làm bánh ngọt ngào nhất Discord!* 🍰`,
        '',
        `**🌿 Nông Trại & Nguyên Liệu**`,
        `\`.garden\` — 🌾 Thu hoạch lúa mỳ, dâu tây, hoa hồng`,
        `\`.farm\` — 🐄 Thu hoạch sữa, trứng, bơ`,
        '',
        `**🔥 Bếp Nướng & Công Thức**`,
        `\`.cookbook\` — 📖 Xem sổ tay các loại bánh và nguyên liệu cần thiết`,
        `\`.bake\` — 🧁 Bắt đầu nướng bánh trong lò`,
        `\`.oven\` — 🔥 Xem hàng đợi của lò và lấy bánh đã nướng xong`,
        '',
        `**🏪 Kinh Doanh & Giao Lưu**`,
        `\`.order\` — 📋 Giao bánh cho khách NPC để nhận Xu & EXP`,
        `\`.shop\` — 🏬 Mở chợ người chơi để mua bán bánh và nguyên liệu`,
        `\`.gift\` — 🎁 Tặng quà cho người chơi khác`,
        `\`.sneak\` — 🐾 Lén trộm đồ của tiệm bánh khác`,
        '',
        `**👤 Hồ Sơ & Nâng Cấp**`,
        `\`.profile\` — 🌸 Xem cấp độ, danh hiệu và thành tích của bạn`,
        `\`.inventory\` — 📦 Xem kho chứa nguyên liệu và bánh`,
        `\`.upgrade\` — ⬆️ Nâng cấp thiết bị`,
        `\`.top\` — 🏆 Xem bảng xếp hạng toàn server`,
        '',
        `**🏦 Ngân Hàng & Tín Dụng**`,
        `\`.chuyentien @user <số_tiền>\` — 💸 Chuyển xu cho người chơi khác`,
        `\`.vay thongtin\` — 💳 Xem khoản nợ ngân hàng hiện tại của bạn`,
        `\`.vay tra <số_tiền>\` — 💸 Trả nợ ngân hàng`,
        '',
        `**🔧 Admin**`,
        `\`.admin\` — Xem các lệnh hệ thống (thêm/trừ xu: \`.admin coins\`)`,
        `\`.vay @user <số_tiền> <lãi_suất>\` — 🏦 (Admin) Cho user vay tiền`,
        `\`.bomtien <số_lượng>\` — 💸 (Dev) Tự bơm tiền vào tài khoản`,
        `\`.admin setchannel add #kênh\` — ⚙️ (Dev) Khóa bot chỉ trả lời ở kênh nhất định`,
      ].join('\n'),
      COLORS.purple
    ).setFooter({ 
      text: 'Tiệm Bánh Mộng Mơ (Official Bot) - Chúc bạn chơi game vui vẻ!',
      iconURL: interaction.client.user.displayAvatarURL()
    });

    // Thêm các nút lối tắt
    const buttons = row(
      btn('cookbook:open', '📖 Sổ Tay Công Thức', 'Primary'),
      btn('profile:open',  '🌸 Hồ Sơ Của Bạn', 'Secondary')
    );

    await interaction.reply({ embeds: [embed], components: [buttons] });
  },
};