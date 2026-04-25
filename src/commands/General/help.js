'use strict';
/**
 * @file help.js
 * @description Lệnh /help — Hiển thị danh sách lệnh và hướng dẫn cơ bản.
 */

const { SlashCommandBuilder } = require('discord.js');
const { bakeryEmbed, row, btn } = require('../../utils/embeds');
const { COLORS } = require('../../utils/constants');
const User = require('../../models/User');
const { getRole, ROLE } = require('../../utils/permissions');

async function buildGuide(userId, guildId, client) {
  const user = await User.findOneAndUpdate({ userId, guildId }, { $setOnInsert: { username: 'Player' } }, { upsert: true, new: true });
  const role = getRole(userId, user);
  let lines = [];

  if (role === ROLE.USER) {
    lines = [
      `**🌱 Chào mừng Nông Dân mới!**`,
      `Là một người chơi cơ bản, nhiệm vụ của bạn là sản xuất nguyên liệu và kiếm tiền.`,
      `1️⃣ Dùng \`!menu\` -> **Thu Hoạch** để lấy lúa mì, dâu, trứng, sữa... (hồi chiêu 30p - 1h)`,
      `2️⃣ Dùng \`!menu\` -> **Giao Dịch** -> **Chợ NPC** để bán nguyên liệu lấy xu.`,
      `3️⃣ Dùng xu để ấp Thú Cưng (\`!menu\` -> **Thú Cưng**) hoặc mua bánh từ người khác.`,
      `4️⃣ Tương tác với người khác bằng lệnh \`!sneak\` (trộm vườn) và \`!nem\` (chọi bánh).`,
      '',
      `*💡 Bạn muốn tự tay nướng bánh và mở tiệm? Hãy xin Admin cấp giấy phép Chủ Shop!*`
    ];
  } else if (role === ROLE.SHOP) {
    lines = [
      `**🏬 Chào mừng Chủ Shop!**`,
      `Bạn đã có giấy phép kinh doanh. Bây giờ bạn có thể Nướng Bánh và Mở Tiệm!`,
      `1️⃣ Dùng \`!menu\` -> **Nướng Bánh** để tạo ra các loại bánh thơm ngon.`,
      `2️⃣ Dùng \`!menu\` -> **Đơn Hàng** để giao bánh cho khách quen (NPC) lấy nhiều xu và EXP.`,
      `3️⃣ Dùng \`!menu\` -> **Quản Lý Shop** để đăng bán bánh của bạn cho người chơi khác!`,
      `4️⃣ Cho Thú Cưng ăn bánh để tăng Lực Chiến mạnh mẽ.`
    ];
  } else {
    lines = [
      `**👑 Chào mừng Nhà Phát Triển (DEV)!**`,
      `Bạn nắm giữ quyền sinh sát toàn bộ server.`,
      `1️⃣ Dùng \`!menu\` -> **Dev Panel** để điều chỉnh kinh tế, buff đồ, ban/unban.`,
      `2️⃣ Dùng \`!admin setshop @user true\` để cấp giấy phép kinh doanh cho người chơi.`,
      `3️⃣ Dùng \`!bomtien <số_lượng>\` để tự bơm xu, hoặc \`!vay cap @user <xu> <lãi>\` để cho vay.`
    ];
  }

  return bakeryEmbed(
    '📖 Cẩm Nang Tiệm Bánh Mộng Mơ',
    [`> *Chào mừng bạn đến với thế giới làm bánh ngọt ngào nhất Discord!* 🍰\n`, ...lines].join('\n'),
    COLORS.purple
  ).setFooter({ text: 'Tiệm Bánh Mộng Mơ (Official Bot)', iconURL: client.user.displayAvatarURL() });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('helpbakery')
    .setDescription('🌸 Xem hướng dẫn và danh sách các lệnh của Tiệm Bánh'),

  /** Chạy khi người dùng gõ !helpbakery */
  async executeMessage(message, args) {
    const embed = await buildGuide(message.author.id, message.guild.id, message.client);

    const buttons = row(
      btn('menu:home', '📱 Mở Menu', 'Success'),
      btn('cookbook:open', '📖 Sổ Tay Công Thức', 'Primary'),
      btn('profile:open',  '🌸 Hồ Sơ Của Bạn', 'Secondary')
    );
    await message.reply({ embeds: [embed], components: [buttons] });
  },

  /** Chạy khi người dùng gõ /helpbakery */
  async execute(interaction) {
    const embed = await buildGuide(interaction.user.id, interaction.guildId, interaction.client);

    // Thêm các nút lối tắt
    const buttons = row(
      btn('menu:home', '📱 Mở Menu', 'Success'),
      btn('cookbook:open', '📖 Sổ Tay Công Thức', 'Primary'),
      btn('profile:open',  '🌸 Hồ Sơ Của Bạn', 'Secondary')
    );

    await interaction.reply({ embeds: [embed], components: [buttons] });
  },
};