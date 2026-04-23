'use strict';
/**
 * @file top.js
 * @description Lệnh /top — Bảng xếp hạng của server.
 *
 * 3 loại bảng xếp hạng, chuyển đổi bằng button:
 *  - 💰 Giàu nhất (xu)
 *  - ⭐ Cấp độ cao nhất (EXP)
 *  - 🧁 Nướng nhiều nhất (totalBaked)
 */

const { SlashCommandBuilder } = require('discord.js');
const User = require('../models/User');
const { bakeryEmbed, btn, row } = require('../utils/embeds');
const { calcLevel, getLevelTitle, COLORS } = require('../utils/gameUtils');
const { COLORS: C } = require('../utils/constants');

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Medals cho top 3 */
const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * Lấy và xây embed bảng xếp hạng theo loại.
 * @param {'coins'|'exp'|'baked'} type
 * @param {string} guildId
 */
async function buildTopEmbed(type, guildId) {
  let title, sortField, formatFn;

  if (type === 'coins') {
    title     = '💰 Bảng Xếp Hạng — Giàu Nhất';
    sortField = { coins: -1 };
    formatFn  = u => `💰 **${u.coins.toLocaleString('vi-VN')}** xu`;
  } else if (type === 'exp') {
    title     = '⭐ Bảng Xếp Hạng — Cấp Độ Cao Nhất';
    sortField = { exp: -1 };
    formatFn  = u => {
      const lvl = calcLevel(u.exp);
      return `⭐ Cấp **${lvl}** — ${getLevelTitle(lvl)}`;
    };
  } else {
    title     = '🧁 Bảng Xếp Hạng — Nướng Nhiều Nhất';
    sortField = { 'stats.totalBaked': -1 };
    formatFn  = u => `🧁 **${u.stats.totalBaked.toLocaleString('vi-VN')}** bánh`;
  }

  const users = await User.find({ guildId })
    .sort(sortField)
    .limit(10)
    .lean();

  if (!users.length) {
    return bakeryEmbed(title, '*Chưa có người chơi nào trong server này!*', C.gold);
  }

  const lines = users.map((u, i) => {
    const medal = MEDALS[i] || `**${i + 1}.**`;
    return `${medal} **${u.username || 'Ẩn Danh'}** — ${formatFn(u)}`;
  });

  return bakeryEmbed(
    title,
    [
      `> *Top 10 tiệm bánh hàng đầu của server* 🌟`,
      '',
      lines.join('\n'),
    ].join('\n'),
    C.gold,
  );
}

/** Hàng nút chuyển đổi bảng xếp hạng. */
function buildTopNav(current) {
  return row(
    btn('top:coins', '💰 Giàu Nhất',    current === 'coins' ? 'Success'   : 'Secondary'),
    btn('top:exp',   '⭐ Cấp Cao Nhất', current === 'exp'   ? 'Success'   : 'Secondary'),
    btn('top:baked', '🧁 Nướng Nhiều',  current === 'baked' ? 'Success'   : 'Secondary'),
  );
}

// ─── Module export ───────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('🏆 Xem bảng xếp hạng của server'),

  /** Mặc định hiển thị bảng giàu nhất khi dùng lệnh. */
  async execute(interaction) {
    await interaction.deferReply();
    const embed = await buildTopEmbed('coins', interaction.guildId);
    await interaction.editReply({
      embeds:     [embed],
      components: [buildTopNav('coins')],
    });
  },

  /**
   * Xử lý button chuyển tab bảng xếp hạng.
   * customId: top:<type>   hoặc   top:open (từ profile)
   */
  async handleComponent(interaction) {
    const type = interaction.customId.split(':')[1];

    if (type === 'open') {
      await interaction.deferReply({ ephemeral: true });
      const embed = await buildTopEmbed('coins', interaction.guildId);
      return interaction.editReply({
        embeds:     [embed],
        components: [buildTopNav('coins')],
      });
    }

    await interaction.deferUpdate();
    const embed = await buildTopEmbed(type, interaction.guildId);
    await interaction.editReply({
      embeds:     [embed],
      components: [buildTopNav(type)],
    });
  },
};
