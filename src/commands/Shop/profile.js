'use strict';
/**
 * @file profile.js
 * @description Lệnh /profile — Xem hồ sơ tiệm bánh của bạn hoặc người khác.
 *
 * Thông tin hiển thị:
 *  - Danh hiệu theo cấp độ
 *  - Xu, cấp độ, thanh EXP
 *  - Thành tích (đã nướng, đã bán, đơn NPC, quà tặng, lần trộm)
 *  - Trạng thái 4 nâng cấp
 *  - Hồi chiêu vườn và trang trại
 *  - Shortcut buttons: Kho đồ, Đơn hàng, Nâng cấp, Bảng XH
 */

const { SlashCommandBuilder } = require('discord.js');
const User = require('../../models/User');
const { bakeryEmbed, btn, row } = require('../../utils/embeds');
const { calcLevel, levelProgress, progressBar, getLevelTitle, formatMs, expForLevel } = require('../../utils/gameUtils');
const { COLORS, UPGRADES } = require('../../utils/constants');
const { getRole, ROLE } = require('../../utils/permissions');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Upsert người dùng vào DB (tạo mới nếu chưa có).
 * @param {string} userId
 * @param {string} guildId
 * @param {string} username
 * @returns {Promise<Document>}
 */
async function getOrCreate(userId, guildId, username) {
  return User.findOneAndUpdate(
    { userId, guildId },
    { $setOnInsert: { username } },
    { upsert: true, new: true },
  );
}

/**
 * Xây EmbedBuilder hồ sơ người dùng.
 * @param {GuildMember|User} target - Đối tượng Discord để lấy displayName + avatar
 * @param {Document}         user   - Document từ MongoDB
 * @returns {EmbedBuilder}
 */
async function buildProfileEmbed(target, user, role) {
  const level = calcLevel(user.exp);
  const { progress, needed, pct } = levelProgress(user.exp, level);
  const bar   = progressBar(pct);
  const title = getLevelTitle(level);
  const now   = Date.now();

  // Tính thời gian còn lại của cooldown (0 nếu đã sẵn sàng)
  const gardenLeft = user.cooldowns.garden
    ? Math.max(0, new Date(user.cooldowns.garden) - now) : 0;
  const farmLeft   = user.cooldowns.farm
    ? Math.max(0, new Date(user.cooldowns.farm) - now)   : 0;

  let descLines = [
    `> *${title}* ✨`,
    '',
    `💰 **Ví:** \`${user.coins.toLocaleString('vi-VN')}\` xu`,
    `⭐ **Cấp ${level}** — ${bar} ${pct}%`,
    `❤️ **HP:** ${Math.floor(user.hp)}/100 *(Hồi 1 HP/3p)*`,
    `✨ **EXP:** ${progress} / ${needed}  *(Tổng lên cấp ${level + 1}: ${expForLevel(level)})*`,
    '',
  ];

  if (role === ROLE.SHOP || role === ROLE.DEV) {
    descLines.push(
      `**🏪 Kinh doanh & Sản xuất**`,
      `🧁 Đã nướng: **${user.stats.totalBaked}**  •  💸 Đã bán: **${user.stats.totalSold}**  •  📋 Đơn NPC: **${user.stats.totalOrders}**`,
      '',
      `**🔧 Nâng cấp tiệm**`,
      `🔥 Lò nướng: Cấp ${user.upgrades.oven || 0}/5  •  🌸 Trang trí: Cấp ${user.upgrades.decor || 0}/5`,
      `🌿 Khu vườn: Cấp ${user.upgrades.garden || 0}/5  •  🏡 Trang trại: Cấp ${user.upgrades.farm || 0}/5`,
      ''
    );
  } else {
    descLines.push(
      `**🔧 Nâng cấp sinh thái**`,
      `🌿 Khu vườn: Cấp ${user.upgrades.garden || 0}/5  •  🏡 Trang trại: Cấp ${user.upgrades.farm || 0}/5`,
      ''
    );
  }

  descLines.push(
    `**🎮 Hoạt động xã hội**`,
    `🎁 Quà tặng: **${user.stats.totalGifts}**  •  🐾 Lần trộm: **${user.stats.totalSneaks}**  •  ⚔️ Thắng PvP: **${user.stats.pvpWins || 0}**`,
    '',
    `**⏰ Hồi chiêu**`,
    `🌿 Vườn: **${gardenLeft > 0 ? formatMs(gardenLeft) : '✅ Sẵn sàng'}**  •  🏡 Trại: **${farmLeft > 0 ? formatMs(farmLeft) : '✅ Sẵn sàng'}**`
  );

  return bakeryEmbed(
    `🍰 Tiệm Bánh Của ${target.displayName || target.username}`,
    descLines.join('\n'),
    COLORS.primary,
  ).setThumbnail(
    // Hỗ trợ cả GuildMember và User object
    typeof target.displayAvatarURL === 'function'
      ? target.displayAvatarURL({ size: 128 })
      : null,
  );
}

// ─── Module export ───────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('🌸 Xem hồ sơ tiệm bánh của bạn')
    .addUserOption(o => o
      .setName('nguoi_dung')
      .setDescription('Xem hồ sơ của người khác (bỏ trống = xem của bạn)')
      .setRequired(false)),

  /**
   * Thực thi lệnh /profile.
   * Nếu không chọn user, hiển thị hồ sơ của người dùng hiện tại.
   */
  async execute(interaction) {
    const targetUser = interaction.options.getUser('nguoi_dung') || interaction.user;

    // Cố gắng lấy GuildMember để có displayName chính xác
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    const display = member || targetUser;

    const user  = await getOrCreate(targetUser.id, interaction.guildId, targetUser.username);
    const role  = getRole(targetUser.id, user);
    const embed = await buildProfileEmbed(display, user, role);

    // Shortcut buttons để nhanh chóng truy cập các tính năng chính
    const buttons = row(
      btn('inventory:open', '📦 Kho Đồ',           'Primary'),
      btn('order:open',     '📋 Đơn Hàng',         'Primary'),
      btn('upgrade:open',   '⬆️ Nâng Cấp',         'Secondary'),
      btn('top:open',       '🏆 Bảng Xếp Hạng',   'Secondary'),
    );

    await interaction.reply({ embeds: [embed], components: [buttons] });
  },

  async handleComponent(interaction) {
    const action = interaction.customId.split(':')[1];
    if (action === 'open') {
      const user = await getOrCreate(interaction.user.id, interaction.guildId, interaction.user.username);
      const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      const display = member || interaction.user;
      const role  = getRole(interaction.user.id, user);
      const embed = await buildProfileEmbed(display, user, role);

      const buttons = row(
        btn('inventory:open', '📦 Kho Đồ',         'Primary'),
        btn('order:open',     '📋 Đơn Hàng',       'Primary'),
        btn('upgrade:open',   '⬆️ Nâng Cấp',       'Secondary'),
        btn('top:open',       '🏆 Bảng Xếp Hạng', 'Secondary'),
        btn('menu:home',      '◀ Menu',             'Secondary'),
      );
      return interaction.update({ embeds: [embed], components: [buttons] });
    }
  }
};
