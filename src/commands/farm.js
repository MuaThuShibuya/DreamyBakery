'use strict';
/**
 * @file farm.js
 * @description Lệnh /farm — Thu hoạch sữa, trứng và bơ từ trang trại.
 *
 * Cơ chế: Tương tự /garden nhưng cooldown 1 giờ và nguyên liệu khác.
 *  - Cooldown 1 giờ, lưu trong DB (user.cooldowns.farm)
 *  - Sản lượng ngẫu nhiên * bonus từ nâng cấp "Trang Trại"
 *  - Nút "Thu Hoạch" disable khi đang cooldown
 *  - Kiểm tra lại cooldown khi xử lý button (chống race condition)
 *
 * Nguyên liệu thu hoạch: 🥛 Sữa Tươi, 🥚 Trứng Gà, 🧈 Bơ
 */

const { SlashCommandBuilder } = require('discord.js');
const User = require('../models/User');
const { bakeryEmbed, successEmbed, btn, row } = require('../utils/embeds');
const { FARM_HARVEST, INGREDIENTS, COOLDOWNS, COLORS, UPGRADES } = require('../utils/constants');
const { formatMs, randomInt } = require('../utils/gameUtils');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Xây embed trạng thái trang trại.
 * @param {Document} user
 * @returns {{ embed: EmbedBuilder, isReady: boolean }}
 */
async function buildFarmEmbed(user) {
  const now       = Date.now();
  const cdEnd     = user.cooldowns.farm ? new Date(user.cooldowns.farm).getTime() : 0;
  const remaining = Math.max(0, cdEnd - now);
  const isReady   = remaining === 0;
  const lvl       = user.upgrades.farm || 0;
  const bonus     = UPGRADES.farm.harvestBonus(lvl);

  const previewLines = Object.entries(FARM_HARVEST).map(([k, r]) => {
    const info = INGREDIENTS[k];
    return `${info.emoji} **${info.name}**: ${Math.floor(r.min * bonus)}–${Math.floor(r.max * bonus)}`;
  });

  return {
    embed: bakeryEmbed(
      '🏡 Trang Trại Sữa',
      [
        `> *Những chú bò vui vẻ đang chào đón bạn!* 🐄`,
        '',
        `**🥛 Sản lượng thu hoạch** *(Trang trại cấp ${lvl}${lvl > 0 ? ` · +${Math.round((bonus - 1) * 100)}% bonus` : ''})*`,
        ...previewLines,
        '',
        isReady
          ? '✅ **Trang trại đã sẵn sàng để thu hoạch!**'
          : `⏰ **Hồi chiêu còn:** \`${formatMs(remaining)}\``,
        '',
        `*Mỗi lần thu hoạch phải chờ **1 giờ** 🕐*`,
      ].join('\n'),
      isReady ? COLORS.success : COLORS.warning,
    ),
    isReady,
  };
}

// ─── Module export ───────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('farm')
    .setDescription('🏡 Thu hoạch sữa, trứng và bơ từ trang trại'),

  /** Hiển thị trạng thái trang trại khi dùng lệnh. */
  async execute(interaction) {
    const user = await User.findOneAndUpdate(
      { userId: interaction.user.id, guildId: interaction.guildId },
      { $setOnInsert: { username: interaction.user.username } },
      { upsert: true, new: true },
    );
    const { embed, isReady } = await buildFarmEmbed(user);

    await interaction.reply({
      embeds:     [embed],
      components: [row(btn('farm:harvest', '🏡 Thu Hoạch', 'Success', !isReady))],
    });
  },

  /**
   * Xử lý button thu hoạch trang trại.
   * customId: farm:harvest
   */
  async handleComponent(interaction) {
    const action = interaction.customId.split(':')[1];

    if (action === 'open') {
      const user = await User.findOneAndUpdate(
        { userId: interaction.user.id, guildId: interaction.guildId },
        { $setOnInsert: { username: interaction.user.username } },
        { upsert: true, new: true },
      );
      const { embed, isReady } = await buildFarmEmbed(user);
      return interaction.reply({
        embeds:     [embed],
        components: [row(btn('farm:harvest', '🏡 Thu Hoạch', 'Success', !isReady))],
        ephemeral:  true,
      });
    }

    if (action !== 'harvest') return;
    await interaction.deferUpdate();

    const user  = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
    const now   = Date.now();
    const cdEnd = user?.cooldowns?.farm ? new Date(user.cooldowns.farm).getTime() : 0;

    // Kiểm tra lại cooldown (chống double-click / race condition)
    if (cdEnd > now) {
      const { embed } = await buildFarmEmbed(user);
      return interaction.editReply({
        embeds:     [embed],
        components: [row(btn('farm:harvest', '🏡 Thu Hoạch', 'Success', true))],
      });
    }

    // Tính và cộng sản lượng có bonus
    const bonus = UPGRADES.farm.harvestBonus(user.upgrades.farm || 0);
    const lines = [];

    for (const [k, r] of Object.entries(FARM_HARVEST)) {
      const amt              = randomInt(Math.floor(r.min * bonus), Math.floor(r.max * bonus));
      user.inventory[k]      = (user.inventory[k] || 0) + amt;
      lines.push(`${INGREDIENTS[k].emoji} **${INGREDIENTS[k].name}**: +${amt}`);
    }

    user.cooldowns.farm = new Date(now + COOLDOWNS.farm);
    user.markModified('inventory');
    await user.save();

    await interaction.editReply({
      embeds: [successEmbed(
        '🏡 Thu Hoạch Thành Công!',
        [
          `> *Những sản vật tươi ngon từ trang trại đây!* 🌟`,
          '',
          '**🎁 Vật phẩm nhận được:**',
          ...lines,
          '',
          `⏰ **Trang trại hồi phục sau:** \`${formatMs(COOLDOWNS.farm)}\``,
          `📦 Dùng \`/bake\` để nướng bánh ngay nhé!`,
        ].join('\n'),
      )],
      components: [row(btn('farm:harvest', '🏡 Thu Hoạch', 'Secondary', true))],
    });
  },
};
