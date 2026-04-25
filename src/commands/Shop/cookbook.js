'use strict';
/**
 * @file cookbook.js
 * @description Lệnh /cookbook — Sổ tay công thức bánh với phân trang.
 *
 * Hiển thị 3 công thức mỗi trang, điều hướng qua nút ◀ / ▶.
 * Mỗi công thức bao gồm:
 *  - Tên và mô tả bánh
 *  - Danh sách nguyên liệu cần thiết (với emoji)
 *  - Thời gian nướng và giá bán
 *  - Tỉ lệ và giá Thượng Hạng (shiny)
 *
 * Số trang hiện tại được đọc từ tiêu đề embed thay vì lưu state,
 * giúp tránh cần database và đơn giản hóa logic.
 */

const { SlashCommandBuilder } = require('discord.js');
const { bakeryEmbed, btn, row } = require('../../utils/embeds');
const { BAKED_GOODS, INGREDIENTS, COLORS } = require('../../utils/constants');

// ─── Hằng số phân trang ───────────────────────────────────────────────────────

/** Tất cả công thức dạng mảng [key, data] để dễ phân trang */
const RECIPES     = Object.entries(BAKED_GOODS);
/** Số công thức hiển thị mỗi trang */
const PER_PAGE    = 3;
/** Tổng số trang */
const TOTAL_PAGES = Math.ceil(RECIPES.length / PER_PAGE);

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Xây EmbedBuilder cho trang công thức.
 * @param {number} page - Chỉ số trang (0-indexed)
 * @returns {EmbedBuilder}
 */
function buildPage(page) {
  const start    = page * PER_PAGE;
  const slice    = RECIPES.slice(start, start + PER_PAGE);

  const sections = slice.map(([, data]) => {
    // Format danh sách nguyên liệu với emoji
    const ingrStr = Object.entries(data.recipe)
      .map(([k, v]) => `${INGREDIENTS[k]?.emoji || '❓'} ${INGREDIENTS[k]?.name || k} ×${v}`)
      .join(', ');

    return [
      `${data.emoji} **${data.name}**`,
      `> 📖 *${data.description}*`,
      `> 🧪 **Nguyên liệu:** ${ingrStr}`,
      `> ⏱️ **Thời gian:** ${data.bakeTime} phút  |  💰 **Bán:** ${data.basePrice} xu`,
      `> ✨ **Thượng Hạng:** ${(data.shinyChance * 100).toFixed(0)}% → ${data.shinyPrice} xu`,
    ].join('\n');
  });

  return bakeryEmbed(
    `📖 Sổ Tay Công Thức  (Trang ${page + 1}/${TOTAL_PAGES})`,
    [
      `> *Mọi bí quyết làm bánh của Tiệm Bánh Mộng Mơ~* 🌸`,
      '',
      sections.join('\n\n'),
    ].join('\n'),
    COLORS.purple,
  );
}

/**
 * Xây hàng nút điều hướng cho cookbook.
 * Disable nút tương ứng khi đang ở trang đầu/cuối.
 * @param {number} page - Trang hiện tại (0-indexed)
 * @returns {ActionRowBuilder}
 */
function buildNav(page, hasBack = false) {
  const r = row(
    btn('cookbook:page:prev', '◀ Trang Trước', 'Secondary', page === 0),
    btn('cookbook:page:next', '▶ Trang Tiếp',  'Secondary', page === TOTAL_PAGES - 1),
  );
  if (hasBack) r.addComponents(btn('menu:section:bake', '◀ Quay Lại', 'Secondary'));
  return r;
}

// ─── Module export ───────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cookbook')
    .setDescription('📖 Xem sổ tay công thức bánh'),

  /** Hiển thị trang đầu của cookbook khi dùng lệnh. */
  async execute(interaction) {
    await interaction.reply({
      embeds:     [buildPage(0)],
      components: [buildNav(0)],
    });
  },

  /**
   * Xử lý nút điều hướng trang.
   * Đọc trang hiện tại từ tiêu đề embed để tính trang tiếp theo.
   * customId: cookbook:page:prev | cookbook:page:next
   */
  async handleComponent(interaction) {
    const dir = interaction.customId.split(':')[2]; // 'prev' hoặc 'next'

    if (parts[1] === 'open') {
      return interaction.update({
        embeds:     [buildPage(0)],
        components: [buildNav(0, true)],
      });
    }

    // Đọc số trang từ tiêu đề embed (VD: "Trang 2/4" → 2 → index 1)
    const titleMatch = interaction.message.embeds[0]?.title?.match(/Trang (\d+)/);
    const current    = titleMatch ? parseInt(titleMatch[1]) - 1 : 0;
    const next       = dir === 'next'
      ? Math.min(current + 1, TOTAL_PAGES - 1)
      : Math.max(current - 1, 0);

    await interaction.update({
      embeds:     [buildPage(next)],
      components: [buildNav(next, true)],
    });
  },
};
