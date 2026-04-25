'use strict';
/**
 * @file garden.js
 * @description Lệnh /garden — Thu hoạch nguyên liệu từ khu vườn bí mật.
 *
 * Cơ chế:
 *  - Cooldown 30 phút, lưu trong DB (user.cooldowns.garden)
 *  - Sản lượng ngẫu nhiên trong khoảng [min*bonus, max*bonus]
 *  - Bonus sản lượng phụ thuộc cấp nâng cấp "Khu Vườn" (UPGRADES.garden.harvestBonus)
 *  - Nút "Thu Hoạch" tự động disable nếu đang cooldown
 *  - Sau khi thu hoạch, kiểm tra lại cooldown để tránh double-claim (race condition)
 *
 * Nguyên liệu thu hoạch: 🌾 Lúa Mì, 🍓 Dâu Tây, 🌹 Hoa Hồng
 */

const { SlashCommandBuilder } = require('discord.js');
const User = require('../../models/User');
const { bakeryEmbed, successEmbed, btn, row } = require('../../utils/embeds');
const { GARDEN_HARVEST, INGREDIENTS, COOLDOWNS, COLORS, UPGRADES } = require('../../utils/constants');
const { formatMs, randomInt } = require('../../utils/gameUtils');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Xây embed hiển thị trạng thái khu vườn (cooldown / sẵn sàng).
 * Hiển thị phạm vi sản lượng theo cấp nâng cấp hiện tại.
 *
 * @param {Document} user - Document người dùng từ MongoDB
 * @returns {{ embed: EmbedBuilder, isReady: boolean }}
 */
async function buildGardenEmbed(user) {
  const now       = Date.now();
  const cdEnd     = user.cooldowns.garden ? new Date(user.cooldowns.garden).getTime() : 0;
  const remaining = Math.max(0, cdEnd - now);
  const isReady   = remaining === 0;
  const lvl       = user.upgrades.garden || 0;
  const bonus     = UPGRADES.garden.harvestBonus(lvl);

  // Hiển thị phạm vi sản lượng sau khi áp dụng bonus nâng cấp
  const previewLines = Object.entries(GARDEN_HARVEST).map(([k, r]) => {
    const info = INGREDIENTS[k];
    return `${info.emoji} **${info.name}**: ${Math.floor(r.min * bonus)}–${Math.floor(r.max * bonus)}`;
  });

  return {
    embed: bakeryEmbed(
      '🌿 Khu Vườn Bí Mật',
      [
        `> *Những bông hoa thơm ngát và trái cây tươi mọng đang chờ bạn...* 🌸`,
        '',
        `**🌱 Sản lượng thu hoạch** *(Vườn cấp ${lvl}${lvl > 0 ? ` · +${Math.round((bonus - 1) * 100)}% bonus` : ''})*`,
        ...previewLines,
        '',
        isReady
          ? '✅ **Vườn đã sẵn sàng để thu hoạch!**'
          : `⏰ **Hồi chiêu còn:** \`${formatMs(remaining)}\``,
        '',
        `*Mỗi lần thu hoạch phải chờ **5 phút** 🕐*`,
      ].join('\n'),
      isReady ? COLORS.success : COLORS.warning,
    ),
    isReady,
  };
}

// ─── Module export ───────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('garden')
    .setDescription('🌿 Thu hoạch nguyên liệu từ khu vườn bí mật'),

  /** Thực thi bằng lệnh !garden */
  async executeMessage(message, args) {
    const user = await User.findOneAndUpdate(
      { userId: message.author.id, guildId: message.guild.id },
      { $setOnInsert: { username: message.author.username } },
      { upsert: true, new: true },
    );
    const { embed, isReady } = await buildGardenEmbed(user);

    await message.reply({
      embeds:     [embed],
      components: [row(btn('garden:harvest', '🌿 Thu Hoạch', 'Success', !isReady))],
    });
  },

  /** Hiển thị trạng thái khu vườn khi dùng lệnh. */
  async execute(interaction) {
    const user = await User.findOneAndUpdate(
      { userId: interaction.user.id, guildId: interaction.guildId },
      { $setOnInsert: { username: interaction.user.username } },
      { upsert: true, new: true },
    );
    const { embed, isReady } = await buildGardenEmbed(user);

    await interaction.reply({
      embeds:     [embed],
      components: [row(btn('garden:harvest', '🌿 Thu Hoạch', 'Success', !isReady))],
    });
  },

  /**
   * Xử lý button thu hoạch.
   * customId: garden:harvest
   *
   * Luồng:
   *  1. deferUpdate để tránh "Interaction failed"
   *  2. Kiểm tra cooldown lần nữa (chống race condition)
   *  3. Tính sản lượng có bonus, cộng vào inventory
   *  4. Đặt cooldown mới, lưu DB
   *  5. Cập nhật message với kết quả
   */
  async handleComponent(interaction) {
    const action = interaction.customId.split(':')[1];

    if (action === 'open') {
      const user = await User.findOneAndUpdate(
        { userId: interaction.user.id, guildId: interaction.guildId },
        { $setOnInsert: { username: interaction.user.username } },
        { upsert: true, new: true },
      );
      const { embed, isReady } = await buildGardenEmbed(user);
      return interaction.update({
        embeds:     [embed],
        components: [row(btn('garden:harvest', '🌿 Thu Hoạch', 'Success', !isReady), btn('menu:home', '◀ Menu', 'Secondary'))],
      });
    }

    if (action !== 'harvest') return;
    await interaction.deferUpdate();

    const user  = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
    const now   = Date.now();
    const cdEnd = user?.cooldowns?.garden ? new Date(user.cooldowns.garden).getTime() : 0;

    // Kiểm tra lại cooldown để tránh double-click / race condition
    if (cdEnd > now) {
      const { embed } = await buildGardenEmbed(user);
      return interaction.editReply({
        embeds:     [embed],
        components: [row(btn('garden:harvest', '🌿 Thu Hoạch', 'Success', true))],
      });
    }

    // Tính và cộng sản lượng vào inventory
    const hasBack = interaction.message.components[0]?.components.some(c => c.customId === 'menu:section:harvest' || c.customId === 'menu:home');
    const backBtn = hasBack ? btn('menu:section:harvest', '◀ Quay Lại', 'Secondary') : null;
    const bonus = UPGRADES.garden.harvestBonus(user.upgrades.garden || 0);
    const lines = [];

    for (const [k, r] of Object.entries(GARDEN_HARVEST)) {
      const amt              = randomInt(Math.floor(r.min * bonus), Math.floor(r.max * bonus));
      user.inventory[k]      = (user.inventory[k] || 0) + amt;
      lines.push(`${INGREDIENTS[k].emoji} **${INGREDIENTS[k].name}**: +${amt}`);
    }

    user.cooldowns.garden = new Date(now + COOLDOWNS.garden);
    user.markModified('inventory');
    await user.save();

    await interaction.editReply({
      embeds: [successEmbed(
        '🌿 Thu Hoạch Thành Công!',
        [
          `> *Bạn đã thu hoạch được những thứ tuyệt vời từ khu vườn!* ✨`,
          '',
          '**🎁 Vật phẩm nhận được:**',
          ...lines,
          '',
          `⏰ **Vườn hồi phục sau:** \`${formatMs(COOLDOWNS.garden)}\``,
          `📦 Dùng \`.inventory\` để xem kho hoặc \`.bake\` để nướng ngay!`,
        ].join('\n'),
      )],
      // Disable nút sau khi đã thu hoạch để tránh nhầm lẫn
    components: [row(btn('garden:harvest', '🌿 Thu Hoạch', 'Secondary', true), ...(backBtn ? [backBtn] : []))],
    });
  },
};
