'use strict';
/**
 * @file help.js
 * @description Lệnh /help — Hiển thị danh sách lệnh và hướng dẫn cơ bản.
 */

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
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
      `1️⃣ Dùng \`.menu\` -> **Khu Sinh Thái** để lấy lúa mì, dâu, trứng, sữa...`,
      `2️⃣ Dùng \`.menu\` -> **Thương Mại** -> **Chợ NPC** để bán nguyên liệu lấy xu.`,
      `3️⃣ Dùng xu để ấp Thú Cưng (\`.menu\` -> **Xã Hội**) hoặc mua bánh từ người khác.`,
      `4️⃣ Tương tác với người khác bằng lệnh \`.sneak\` (trộm vườn) và \`.nem\` (chọi bánh).`,
      '',
      `*💡 Bạn muốn tự tay nướng bánh và mở tiệm? Hãy xin Admin cấp giấy phép Chủ Shop!*`
    ];
  } else if (role === ROLE.SHOP) {
    lines = [
      `**🏬 Chào mừng Chủ Shop!**`,
      `Bạn đã có giấy phép kinh doanh. Bây giờ bạn có thể Nướng Bánh và Mở Tiệm!`,
      `1️⃣ Dùng \`.menu\` -> **Khu Kinh Doanh** -> **Nướng Bánh** để tạo ra các loại bánh thơm ngon.`,
      `2️⃣ Dùng \`.menu\` -> **Khu Kinh Doanh** -> **Đơn Hàng** để giao bánh cho khách quen.`,
      `3️⃣ Dùng \`.menu\` -> **Khu Kinh Doanh** -> **Shop Của Bạn** để đăng bán bánh!`,
      `4️⃣ Cho Thú Cưng ăn bánh để tăng Lực Chiến mạnh mẽ.`
    ];
  } else {
    lines = [
      `**👑 Chào mừng Nhà Phát Triển (DEV)!**`,
      `Bạn nắm giữ quyền sinh sát toàn bộ server.`,
      `1️⃣ Dùng \`.menu\` -> **Bảng Điều Khiển Dev** để điều chỉnh kinh tế, buff đồ, ban/unban.`,
      `2️⃣ Dùng \`.admin setshop @user true\` để cấp giấy phép kinh doanh cho người chơi.`,
      `3️⃣ Dùng \`.bomtien <số_lượng>\` để tự bơm xu, hoặc \`.vay cap @user <xu> <lãi>\` để cho vay.`
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

    const row1 = row(
      btn('menu:home', '📱 Mở Menu Tổng', 'Success'),
      btn('helpbakery:docs', '📚 Tài Liệu Lệnh', 'Primary'),
      btn('profile:open',  '👤 Hồ Sơ Của Bạn', 'Secondary')
    );
    const row2 = row(
      btn('garden:open', '🌿 Ra Vườn', 'Secondary'),
      btn('market:open', '🏪 Chợ NPC', 'Secondary'),
      btn('cookbook:open', '📖 Sổ Tay Nướng Bánh', 'Secondary')
    );
    await message.reply({ embeds: [embed], components: [row1, row2] });
  },

  /** Chạy khi người dùng gõ /helpbakery */
  async execute(interaction) {
    const embed = await buildGuide(interaction.user.id, interaction.guildId, interaction.client);

    const row1 = row(
      btn('menu:home', '📱 Mở Menu Tổng', 'Success'),
      btn('helpbakery:docs', '📚 Tài Liệu Lệnh', 'Primary'),
      btn('profile:open',  '👤 Hồ Sơ Của Bạn', 'Secondary')
    );
    const row2 = row(
      btn('garden:open', '🌿 Ra Vườn', 'Secondary'),
      btn('market:open', '🏪 Chợ NPC', 'Secondary'),
      btn('cookbook:open', '📖 Sổ Tay Nướng Bánh', 'Secondary')
    );
    await interaction.reply({ embeds: [embed], components: [row1, row2] });
  },

  async handleComponent(interaction) {
    if (interaction.customId === 'helpbakery:docs') {
      const embed = bakeryEmbed(
        '📚 Tài Liệu Các Lệnh Cơ Bản',
        [
          `**Cú pháp chung:** Sử dụng dấu chấm \`.\` trước mỗi lệnh.`,
          '',
          `**🌟 Lệnh Hệ Thống:**`,
          `\`.menu\` - Mở bảng điều khiển trung tâm (Super App)`,
          `\`.helpbakery\` - Xem hướng dẫn chi tiết`,
          '',
          `**🎮 Lệnh Tương Tác & Chơi Game:**`,
          `\`.daily\` - Nhận xu điểm danh mỗi ngày`,
          `\`.nem @user <tên_bánh>\` - Ném bánh vào người khác để cướp xu`,
          `\`.sneak @user\` - Lén sang nhà người khác trộm vườn`,
          `\`.gift @user <vật_phẩm> <số_lượng>\` - Tặng quà cho bạn bè`,
          `\`.chuyentien @user <xu>\` - Chuyển khoản xu`,
          '',
          `**🛒 Lệnh Nông Dân & Thương Mại:**`,
          `\`.garden\` / \`.farm\` - Lệnh nhanh thu hoạch`,
          `\`.inventory\` - Xem túi đồ nhanh`,
          `\`.market\` - Đi chợ NPC`,
          `\`.shop\` - Mua bánh từ người chơi khác`,
          `\`.top\` - Bảng xếp hạng server`,
          '',
          `**🏬 Lệnh Chủ Shop:**`,
          `\`.bake\` (Nướng bánh) / \`.oven\` (Lấy bánh) / \`.cookbook\` / \`.order\``
        ].join('\n'),
        COLORS.primary
      );
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }
};