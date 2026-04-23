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
const User = require('../models/User');
const { bakeryEmbed, btn, row } = require('../utils/embeds');
const { calcLevel, levelProgress, progressBar, getLevelTitle, formatMs, expForLevel } = require('../utils/gameUtils');
const { COLORS, UPGRADES } = require('../utils/constants');

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
async function buildProfileEmbed(target, user) {
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

  // Dòng trạng thái 4 nâng cấp hiển thị gọn trên 1 dòng
  const upgrLines = Object.entries(UPGRADES)
    .map(([key, u]) => `${u.emoji} **${u.name}**: Cấp ${user.upgrades[key] || 0}/${u.maxLevel}`)
    .join('  |  ');

  return bakeryEmbed(
    `🍰 Tiệm Bánh Của ${target.displayName || target.username}`,
    [
      `> *${title}* ✨`,
      '',
      `💰 **Xu:** \`${user.coins.toLocaleString('vi-VN')}\` xu`,
      `⭐ **Cấp ${level}** — ${bar} ${pct}%`,
      `✨ **EXP:** ${progress} / ${needed}  *(Tổng lên cấp ${level + 1}: ${expForLevel(level)})*`,
      '',
      `**📊 Thành tích**`,
      `🧁 Đã nướng **${user.stats.totalBaked}** bánh  •  💸 Đã bán **${user.stats.totalSold}**`,
      `📋 Đơn NPC **${user.stats.totalOrders}**  •  🎁 Quà tặng **${user.stats.totalGifts}**  •  🐾 Lần trộm **${user.stats.totalSneaks}**`,
      '',
      `**🔧 Nâng cấp**`,
      upgrLines,
      '',
      `**⏰ Hồi chiêu**`,
      `🌿 Khu vườn: **${gardenLeft > 0 ? formatMs(gardenLeft) : '✅ Sẵn sàng'}**  •  🏡 Trang trại: **${farmLeft > 0 ? formatMs(farmLeft) : '✅ Sẵn sàng'}**`,
    ].join('\n'),
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
    const embed = await buildProfileEmbed(display, user);

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
      const embed = await buildProfileEmbed(display, user);

      const buttons = row(
        btn('inventory:open', '📦 Kho Đồ', 'Primary'),
        btn('order:open', '📋 Đơn Hàng', 'Primary'),
        btn('upgrade:open', '⬆️ Nâng Cấp', 'Secondary'),
        btn('top:open', '🏆 Bảng Xếp Hạng', 'Secondary'),
      );
      return interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
    }
  }
};
