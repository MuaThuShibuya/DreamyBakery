'use strict';
/**
 * @file inventory.js
 * @description Lệnh /inventory — Xem kho đồ với 3 trang có thể chuyển đổi.
 *
 * Trang 1: 🌿 Nguyên Liệu — Tất cả nguyên liệu (vườn, trang trại, chợ)
 * Trang 2: 🧁 Bánh Đã Nướng — Bánh thường với giá bán
 * Trang 3: ✨ Bánh Thượng Hạng — Bánh shiny nếu có
 *
 * Tổng giá trị bánh hiển thị ở mọi trang để người chơi biết tài sản của mình.
 * Có thể mở từ nút shortcut trong /profile (ephemeral).
 */

const { SlashCommandBuilder } = require('discord.js');
const User = require('../models/User');
const { bakeryEmbed, errorEmbed, btn, row } = require('../utils/embeds');
const { INGREDIENTS, BAKED_GOODS, COLORS, BAKED_KEYS, INGR_KEYS } = require('../utils/constants');

// ─── Cấu hình trang ──────────────────────────────────────────────────────────

/** Thứ tự 3 trang của inventory */
const PAGES = ['ingredients', 'baked', 'shiny'];

/** Nhãn tiêu đề cho từng trang */
const PAGE_LABELS = {
  ingredients: '🌿 Nguyên Liệu',
  baked:       '🧁 Bánh Đã Nướng',
  shiny:       '✨ Bánh Thượng Hạng',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Tính tổng giá trị bánh (cả thường và shiny) trong kho.
 * Dùng để hiển thị "tài sản" của người chơi.
 * @param {Object} inv - user.inventory
 * @returns {number} Tổng xu giá trị
 */
function calcBakedValue(inv) {
  return BAKED_KEYS.reduce((sum, k) => {
    sum += (inv[k]             || 0) * BAKED_GOODS[k].basePrice;
    sum += (inv[`shiny_${k}`] || 0) * BAKED_GOODS[k].shinyPrice;
    return sum;
  }, 0);
}

/**
 * Xây EmbedBuilder cho một trang inventory.
 * @param {Document} user - Document người dùng từ MongoDB
 * @param {string}   page - 'ingredients' | 'baked' | 'shiny'
 * @returns {EmbedBuilder}
 */
function buildInvEmbed(user, page) {
  const inv        = user.inventory;
  const totalValue = calcBakedValue(inv);
  let lines        = [];

  if (page === 'ingredients') {
    // Nhóm nguyên liệu theo nguồn gốc
    const fmt = keys => keys.map(k => {
      const info = INGREDIENTS[k];
      const qty  = inv[k] || 0;
      return `${info.emoji} **${info.name}**: ${qty > 0 ? `\`${qty}\`` : '*trống*'}`;
    }).join('\n');

    lines = [
      `🌿 **Nguyên liệu từ vườn**\n${fmt(INGR_KEYS.filter(k => INGREDIENTS[k].source === 'garden'))}`,
      '',
      `🏡 **Nguyên liệu từ trang trại**\n${fmt(INGR_KEYS.filter(k => INGREDIENTS[k].source === 'farm'))}`,
      '',
      `🛒 **Nguyên liệu hiếm (từ chợ)**\n${fmt(INGR_KEYS.filter(k => INGREDIENTS[k].source === 'market'))}`,
    ];
  }

  else if (page === 'baked') {
    const items = BAKED_KEYS.map(k => {
      const info = BAKED_GOODS[k];
      const qty  = inv[k] || 0;
      return `${info.emoji} **${info.name}**: ${qty > 0 ? `\`${qty}\`` : '*trống*'}  —  *${info.basePrice} xu/cái*`;
    });
    lines = items;
  }

  else { // shiny
    const shinyItems = BAKED_KEYS.map(k => {
      const shinyQty = inv[`shiny_${k}`] || 0;
      if (!shinyQty) return null;
      const info = BAKED_GOODS[k];
      return `✨ **${info.name} (Thượng Hạng)**: \`${shinyQty}\`  —  *${info.shinyPrice} xu/cái*`;
    }).filter(Boolean);

    lines = shinyItems.length
      ? shinyItems
      : ['*Bạn chưa có bánh Thượng Hạng nào.*', '', '*Tiếp tục nướng bánh để có cơ hội nhận được! ✨*'];
  }

  return bakeryEmbed(
    `📦 Kho Đồ — ${PAGE_LABELS[page]}`,
    [
      `> *Tổng giá trị bánh: **${totalValue.toLocaleString('vi-VN')} xu*** 🍰`,
      '',
      ...lines,
    ].join('\n'),
    COLORS.purple,
  );
}

/**
 * Xây hàng nút điều hướng prev/next cho inventory.
 * @param {string} currentPage - Trang hiện tại
 * @returns {ActionRowBuilder}
 */
function buildNav(currentPage) {
  const idx  = PAGES.indexOf(currentPage);
  const prev = PAGES[(idx - 1 + PAGES.length) % PAGES.length];
  const next = PAGES[(idx + 1) % PAGES.length];

  return row(
    btn(`inventory:page:${prev}`, `◀ ${PAGE_LABELS[prev]}`, 'Secondary'),
    btn(`inventory:page:${next}`, `▶ ${PAGE_LABELS[next]}`, 'Secondary'),
  );
}

// ─── Module export ───────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('📦 Xem kho đồ của bạn'),

  /** Thực thi bằng lệnh !inventory */
  async executeMessage(message, args) {
    const user = await User.findOneAndUpdate(
      { userId: message.author.id, guildId: message.guild.id },
      { $setOnInsert: { username: message.author.username } },
      { upsert: true, new: true },
    );
    await message.reply({
      embeds:     [buildInvEmbed(user, 'ingredients')],
      components: [buildNav('ingredients')],
    });
  },

  /** Mở inventory từ slash command, mặc định trang nguyên liệu. */
  async execute(interaction) {
    const user = await User.findOneAndUpdate(
      { userId: interaction.user.id, guildId: interaction.guildId },
      { $setOnInsert: { username: interaction.user.username } },
      { upsert: true, new: true },
    );
    await interaction.reply({
      embeds:     [buildInvEmbed(user, 'ingredients')],
      components: [buildNav('ingredients')],
    });
  },

  /**
   * Xử lý button của /inventory.
   *  inventory:open        — Mở ephemeral từ profile shortcut
   *  inventory:page:<page> — Chuyển trang
   */
  async handleComponent(interaction) {
    const [, action, page] = interaction.customId.split(':');

    // Mở ephemeral khi bấm từ nút profile
    if (action === 'open') {
      const user = await User.findOneAndUpdate(
        { userId: interaction.user.id, guildId: interaction.guildId },
        { $setOnInsert: { username: interaction.user.username } },
        { upsert: true, new: true },
      );
      return interaction.reply({
        embeds:     [buildInvEmbed(user, 'ingredients')],
        components: [buildNav('ingredients')],
        ephemeral:  true,
      });
    }

    // Chuyển trang — cập nhật message hiện tại
    if (action === 'page') {
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      if (!user) return interaction.update({ embeds: [errorEmbed('Bạn chưa có tài khoản!')], components: [] });

      return interaction.update({
        embeds:     [buildInvEmbed(user, page)],
        components: [buildNav(page)],
      });
    }
  },
};
