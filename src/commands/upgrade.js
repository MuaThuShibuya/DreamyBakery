'use strict';
/**
 * @file upgrade.js
 * @description Lệnh /upgrade — Cửa hàng nâng cấp tiệm bánh.
 *
 * 4 loại nâng cấp, mỗi loại tối đa cấp 5:
 *  - 🔥 Lò Nướng   : Giảm thời gian nướng bánh
 *  - 🌸 Trang Trí  : Tăng số đơn NPC mỗi ngày
 *  - 🌿 Khu Vườn   : Tăng sản lượng thu hoạch vườn
 *  - 🏡 Trang Trại : Tăng sản lượng thu hoạch trang trại
 */

const { SlashCommandBuilder } = require('discord.js');
const User = require('../models/User');
const { bakeryEmbed, errorEmbed, successEmbed, btn, row } = require('../utils/embeds');
const { UPGRADES, COLORS } = require('../utils/constants');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Xây embed hiển thị cửa hàng nâng cấp với trạng thái hiện tại của user.
 * @param {Document} user — Document người dùng từ MongoDB
 */
function buildUpgradeEmbed(user) {
  const lines = Object.entries(UPGRADES).map(([key, u]) => {
    const current = user.upgrades[key] || 0;
    const isMax   = current >= u.maxLevel;
    const nextCost = isMax ? null : u.costs[current + 1];

    return [
      `${u.emoji} **${u.name}** — Cấp ${current}/${u.maxLevel}`,
      `  📖 ${u.description}`,
      `  ✨ Hiệu quả hiện tại: *${current > 0 ? u.effect(current) : 'Chưa nâng cấp'}*`,
      isMax
        ? `  🏅 **Đã đạt cấp tối đa!**`
        : `  💰 Nâng lên cấp ${current + 1}: **${nextCost?.toLocaleString('vi-VN')} xu**`,
    ].join('\n');
  });

  return bakeryEmbed(
    '⬆️ Cửa Hàng Nâng Cấp',
    [
      `> *Đầu tư cho tiệm bánh của bạn để kiếm nhiều hơn!* 💫`,
      `> 💰 Xu hiện có: **${user.coins.toLocaleString('vi-VN')} xu**`,
      '',
      lines.join('\n\n'),
    ].join('\n'),
    COLORS.gold,
  );
}

/**
 * Xây hàng nút cho từng loại nâng cấp.
 * @param {Document} user
 */
function buildUpgradeButtons(user) {
  const btns = Object.entries(UPGRADES).map(([key, u]) => {
    const current  = user.upgrades[key] || 0;
    const isMax    = current >= u.maxLevel;
    const nextCost = isMax ? 0 : u.costs[current + 1];
    const canAfford = !isMax && user.coins >= nextCost;
    const label    = isMax ? `${u.emoji} Cấp Max` : `${u.emoji} +1 (${nextCost?.toLocaleString('vi-VN')}xu)`;

    return btn(`upgrade:buy:${key}`, label, canAfford ? 'Success' : 'Secondary', isMax || !canAfford);
  });

  // Chia thành 2 hàng, mỗi hàng 2 nút
  return [row(...btns.slice(0, 2)), row(...btns.slice(2, 4))];
}

// ─── Module export ───────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('upgrade')
    .setDescription('⬆️ Nâng cấp tiệm bánh của bạn'),

  /** Hiển thị màn nâng cấp với trạng thái hiện tại. */
  async execute(interaction) {
    const user = await User.findOneAndUpdate(
      { userId: interaction.user.id, guildId: interaction.guildId },
      { $setOnInsert: { username: interaction.user.username } },
      { upsert: true, new: true },
    );
    await interaction.reply({
      embeds:     [buildUpgradeEmbed(user)],
      components: buildUpgradeButtons(user),
    });
  },

  /**
   * Xử lý tương tác button:
   *  upgrade:buy:<key>   — Mua nâng cấp
   *  upgrade:open        — Mở từ profile (ephemeral)
   */
  async handleComponent(interaction) {
    const parts  = interaction.customId.split(':');
    const action = parts[1];

    // Mở từ nút Profile (hiện ephemeral)
    if (action === 'open') {
      const user = await User.findOneAndUpdate(
        { userId: interaction.user.id, guildId: interaction.guildId },
        { $setOnInsert: { username: interaction.user.username } },
        { upsert: true, new: true },
      );
      return interaction.reply({
        embeds:     [buildUpgradeEmbed(user)],
        components: buildUpgradeButtons(user),
        ephemeral:  true,
      });
    }

    if (action === 'buy') {
      await interaction.deferUpdate();
      const key  = parts[2];
      const u    = UPGRADES[key];
      if (!u) return;

      const user    = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const current = user.upgrades[key] || 0;

      // Kiểm tra đã max chưa
      if (current >= u.maxLevel) {
        return interaction.editReply({ embeds: [errorEmbed(`**${u.name}** đã đạt cấp tối đa rồi!`)], components: buildUpgradeButtons(user) });
      }

      const cost = u.costs[current + 1];

      // Kiểm tra đủ xu không
      if (user.coins < cost) {
        return interaction.editReply({
          embeds: [errorEmbed(`Không đủ xu! Cần **${cost.toLocaleString('vi-VN')}** xu để nâng cấp **${u.emoji} ${u.name}** lên cấp ${current + 1}.\nHiện có: **${user.coins.toLocaleString('vi-VN')}** xu.`)],
          components: buildUpgradeButtons(user),
        });
      }

      // Thực hiện nâng cấp
      user.coins         -= cost;
      user.upgrades[key]  = current + 1;
      await user.save();

      await interaction.editReply({
        embeds: [successEmbed(
          `⬆️ Nâng Cấp Thành Công!`,
          [
            `${u.emoji} **${u.name}** lên **Cấp ${current + 1}**!`,
            `✨ Hiệu quả mới: *${u.effect(current + 1)}*`,
            `💸 Đã chi: **${cost.toLocaleString('vi-VN')}** xu`,
            `💰 Xu còn lại: **${user.coins.toLocaleString('vi-VN')}** xu`,
          ].join('\n'),
        )],
        components: buildUpgradeButtons(user),
      });
    }
  },
};
