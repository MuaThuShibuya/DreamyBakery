'use strict';
/**
 * @file oven.js
 * @description Lệnh /oven — Theo dõi hàng đợi lò nướng và nhận bánh đã xong.
 *
 * Hiển thị:
 *  - ✅ Bánh đã xong: tên, số lượng, có shiny không
 *  - 🔥 Đang nướng: tên, số lượng, thời gian còn lại
 *
 * Nút "Lấy Bánh!": collect tất cả job đã xong, thêm vào inventory.
 * Nút "Làm Mới"  : reload trạng thái từ DB (nếu user muốn kiểm tra timer).
 *
 * Collect logic:
 *  - Xóa các job đã xong khỏi bakingQueue
 *  - Cộng vào inventory đúng slot (shiny_ hoặc thường)
 *  - Không thêm EXP khi collect (EXP đã tính lúc bake)
 */

const { SlashCommandBuilder } = require('discord.js');
const User = require('../../models/User');
const { bakeryEmbed, successEmbed, btn, row } = require('../../utils/embeds');
const { BAKED_GOODS, COLORS } = require('../../utils/constants');
const { formatMs } = require('../../utils/gameUtils');
const { isShopOrAbove } = require('../../utils/permissions');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Xây embed trạng thái lò nướng và trả về metadata cần thiết.
 * @param {Document} user
 * @returns {{ embed: EmbedBuilder, hasDone: boolean }}
 */
function buildOvenEmbed(user) {
  const now    = new Date();
  const queue  = user.bakingQueue || [];
  const done   = queue.filter(j => new Date(j.finishTime) <= now);
  const baking = queue.filter(j => new Date(j.finishTime) >  now);

  // Danh sách bánh đã xong
  const doneLines = done.length
    ? done.map(j => {
        const info  = BAKED_GOODS[j.item];
        const label = j.isShiny ? `✨ **${info.name} (Thượng Hạng)**` : `${info.emoji} **${info.name}**`;
        return `✅ ${label} × ${j.quantity} — *Đã xong, lấy ngay thôi!*`;
      })
    : ['*(Không có bánh nào đã xong)*'];

  // Danh sách bánh đang nướng với đếm ngược
  const bakingLines = baking.length
    ? baking.map(j => {
        const info  = BAKED_GOODS[j.item];
        const left  = formatMs(new Date(j.finishTime) - now);
        const label = j.isShiny ? `✨ ${info.name}` : `${info.emoji} ${info.name}`;
        return `🔥 **${label}** × ${j.quantity} — Còn \`${left}\``;
      })
    : ['*(Lò đang trống)*'];

  return {
    embed: bakeryEmbed(
      '🔥 Lò Nướng',
      [
        `> *Theo dõi hàng đợi lò nướng của bạn~*`,
        '',
        `**✅ Đã xong (${done.length})**`,
        ...doneLines,
        '',
        `**🔥 Đang nướng (${baking.length})**`,
        ...bakingLines,
      ].join('\n'),
      done.length > 0 ? COLORS.success : COLORS.warning,
    ),
    hasDone: done.length > 0,
  };
}

// ─── Module export ───────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('oven')
    .setDescription('🔥 Xem lò nướng và lấy bánh đã xong'),

  /** Hiển thị trạng thái lò nướng khi dùng lệnh. */
  async execute(interaction) {
    const user = await User.findOneAndUpdate(
      { userId: interaction.user.id, guildId: interaction.guildId },
      { $setOnInsert: { username: interaction.user.username } },
      { upsert: true, new: true },
    );
    
    if (!isShopOrAbove(interaction.user.id, user)) return interaction.reply({ embeds: [errorEmbed('🔒 Lò nướng chỉ dành cho Chủ Shop!')], ephemeral: true });

    const { embed, hasDone } = buildOvenEmbed(user);

    await interaction.reply({
      embeds:     [embed],
      components: [row(
        btn('oven:collect', '🎁 Lấy Bánh!', 'Success',   !hasDone),
        btn('oven:refresh', '🔄 Làm Mới',   'Secondary'),
      )],
    });
  },

  /**
   * Xử lý button của /oven.
   *  oven:refresh — Reload trạng thái từ DB
   *  oven:collect — Thu thập tất cả bánh đã xong
   */
  async handleComponent(interaction) {
    const action = interaction.customId.split(':')[1];

    // Kiểm tra bảo mật Back-end
    const userSec = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
    if (!isShopOrAbove(interaction.user.id, userSec)) {
      return interaction.reply({ embeds: [errorEmbed('🔒 Truy cập trái phép! Chỉ Chủ Shop mới được dùng Lò Nướng.')], ephemeral: true });
    }

    // ── Mở từ menu ──────────────────────────────────────────────────────────
    if (action === 'open') {
      const user = await User.findOneAndUpdate(
        { userId: interaction.user.id, guildId: interaction.guildId },
        { $setOnInsert: { username: interaction.user.username } },
        { upsert: true, new: true },
      );

      if (!isShopOrAbove(interaction.user.id, user)) return interaction.reply({ embeds: [errorEmbed('🔒 Lò nướng chỉ dành cho Chủ Shop!')], ephemeral: true });

      const { embed, hasDone } = buildOvenEmbed(user);
      return interaction.reply({
        embeds:     [embed],
        components: [
          row(btn('oven:collect', '🎁 Lấy Bánh!', 'Success', !hasDone)),
          row(btn('oven:refresh', '🔄 Làm Mới', 'Primary'), btn('menu:section:bake', '◀ Về Bếp', 'Secondary')),
          row(btn('menu:home', '🏠 Về Trang Chủ', 'Secondary'))
        ],
        ephemeral:  true,
      });
    }

    // ── Làm mới: chỉ reload và update message ───────────────────────────────
    if (action === 'refresh') {
      await interaction.deferUpdate();
      const hasBack = interaction.message.components.some(r => r.components.some(c => c.customId === 'menu:section:bake'));
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const { embed, hasDone } = buildOvenEmbed(user);
      return interaction.editReply({
        embeds:     [embed],
        components: [
          row(btn('oven:collect', '🎁 Lấy Bánh!', 'Success', !hasDone)),
          row(btn('oven:refresh', '🔄 Làm Mới', 'Primary'), ...(hasBack ? [btn('menu:section:bake', '◀ Về Bếp', 'Secondary')] : [])),
          ...(hasBack ? [row(btn('menu:home', '🏠 Về Trang Chủ', 'Secondary'))] : [])
        ].filter(Boolean),
      });
    }

    // ── Collect: thêm bánh đã xong vào inventory ────────────────────────────
    if (action === 'collect') {
      await interaction.deferUpdate();
      const hasBack = interaction.message.components.some(r => r.components.some(c => c.customId === 'menu:section:bake'));
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const now  = new Date();
      const done = (user.bakingQueue || []).filter(j => new Date(j.finishTime) <= now);

      // Không có gì để lấy (có thể user bấm nhanh trước khi xong)
      if (!done.length) {
        const { embed } = buildOvenEmbed(user);
        return interaction.editReply({
          embeds:     [embed],
          components: [
            row(btn('oven:collect', '🎁 Lấy Bánh!', 'Success', true)),
            row(btn('oven:refresh', '🔄 Làm Mới', 'Primary'), ...(hasBack ? [btn('menu:section:bake', '◀ Về Bếp', 'Secondary')] : [])),
            ...(hasBack ? [row(btn('menu:home', '🏠 Về Trang Chủ', 'Secondary'))] : [])
          ].filter(Boolean),
        });
      }

      // Cộng từng job đã xong vào đúng slot inventory (shiny hoặc thường)
      const lines = [];
      for (const job of done) {
        const info   = BAKED_GOODS[job.item];
        const invKey = job.isShiny ? `shiny_${job.item}` : job.item;
        const label  = job.isShiny ? `✨ ${info.name} (Thượng Hạng)` : `${info.emoji} ${info.name}`;

        user.inventory[invKey] = (user.inventory[invKey] || 0) + job.quantity;
        lines.push(`${label} × **${job.quantity}**`);
      }

      // Xóa các job đã xong, giữ lại các job đang nướng
      user.bakingQueue = (user.bakingQueue || []).filter(j => new Date(j.finishTime) > now);
      user.markModified('inventory');
      await user.save();

      await interaction.editReply({
        embeds: [successEmbed(
          '🎁 Đã Lấy Bánh!',
          [
            `> *Mùi bánh thơm lừng cả tiệm!* ✨`,
            '',
            '**Bánh nhận được:**',
            ...lines,
            '',
            `📦 Dùng \`.inventory\` để xem kho hoặc \`.shop\` để bán!`,
          ].join('\n'),
        )],
        components: [
          row(btn('oven:collect', '🎁 Lấy Bánh!', 'Success', true)),
          row(btn('oven:refresh', '🔄 Làm Mới', 'Primary'), ...(hasBack ? [btn('menu:section:bake', '◀ Về Bếp', 'Secondary')] : [])),
          ...(hasBack ? [row(btn('menu:home', '🏠 Về Trang Chủ', 'Secondary'))] : [])
        ].filter(Boolean),
      });
    }
  },
};
