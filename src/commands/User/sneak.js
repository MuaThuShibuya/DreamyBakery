'use strict';
/**
 * @file sneak.js
 * @description Lệnh /sneak — Mini-game lén vào vườn của người khác để trộm nguyên liệu.
 *
 * 3 kết quả có trọng số:
 *  - 40% Thành công : Trộm được 2-5 nguyên liệu ngẫu nhiên từ vườn mục tiêu
 *  - 35% Bị bắt    : Không mất gì, mục tiêu biết bị trộm hụt
 *  - 25% Chó cắn   : Mất 5-10 nguyên liệu ngẫu nhiên từ kho của mình
 *
 * Hồi chiêu: 2 giờ (lưu trong DB).
 * Mục tiêu chỉ có thể bị trộm nguyên liệu vườn (wheat, strawberry, rose).
 */

const { SlashCommandBuilder } = require('discord.js');
const User = require('../../models/User');
const { bakeryEmbed, errorEmbed, btn, row } = require('../../utils/embeds');
const { INGREDIENTS, COOLDOWNS, COLORS } = require('../../utils/constants');
const { formatMs, randomInt } = require('../../utils/gameUtils');

/** Nguyên liệu có thể bị trộm từ vườn */
const STEALABLE = ['wheat', 'strawberry', 'rose'];

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Chọn ngẫu nhiên một kết quả dựa trên trọng số.
 * @returns {'success'|'caught'|'dog'}
 */
function rollOutcome() {
  const r = Math.random();
  if (r < 0.40) return 'success';
  if (r < 0.75) return 'caught';
  return 'dog';
}

/**
 * Chọn ngẫu nhiên một loại nguyên liệu từ danh sách stealable
 * mà mục tiêu đang có số lượng > 0.
 * @param {Object} inventory — Inventory của mục tiêu
 * @returns {string|null} itemKey hoặc null nếu mục tiêu không có gì
 */
function pickStealable(inventory) {
  const available = STEALABLE.filter(k => (inventory[k] || 0) > 0);
  if (!available.length) return null;
  return available[Math.floor(Math.random() * available.length)];
}

/** Logic xử lý trộm dùng chung cho cả lệnh và UI */
async function processSneak(interaction, target, isUpdate = false) {
  const sendReply = async (payload) => isUpdate ? interaction.update(payload) : interaction.reply({ ...payload, ephemeral: true });

  if (target.id === interaction.user.id) return sendReply({ embeds: [errorEmbed('Bạn không thể trộm chính mình! 😂')] });
  if (target.bot) return sendReply({ embeds: [errorEmbed('Không thể trộm bot!')] });

  const thief = await User.findOneAndUpdate({ userId: interaction.user.id, guildId: interaction.guildId }, { $setOnInsert: { username: interaction.user.username } }, { upsert: true, new: true });

  const now    = Date.now();
  const cdEnd  = thief.cooldowns.sneak ? new Date(thief.cooldowns.sneak).getTime() : 0;
  const cdLeft = Math.max(0, cdEnd - now);
  if (cdLeft > 0) {
    return sendReply({
        embeds: [bakeryEmbed(
          '⏰ Bạn Vừa Mới Trộm Xong!',
          `Hãy chờ **${formatMs(cdLeft)}** nữa trước khi trộm tiếp nhé~ 🐾`,
          COLORS.warning,
        )],
    });
  }

  const victim = await User.findOneAndUpdate({ userId: target.id, guildId: interaction.guildId }, { $setOnInsert: { username: target.username } }, { upsert: true, new: true });
  const outcome = rollOutcome();
  thief.cooldowns.sneak = new Date(now + COOLDOWNS.sneak);
  thief.stats.totalSneaks = (thief.stats.totalSneaks || 0) + 1;
  let embed;

  if (outcome === 'success') {
    const stealKey = pickStealable(victim.inventory);
    if (!stealKey) {
      await thief.save();
      embed = bakeryEmbed(
          '🐾 Hụt Mất Rồi!',
          [
            `Bạn lẻn vào vườn của **${target.displayName}** nhưng...`,
            `> *Vườn trống trơn! Không có gì để lấy cả!* 😅`,
            '',
            `⏰ Hồi chiêu: \`${formatMs(COOLDOWNS.sneak)}\``,
          ].join('\n'),
          COLORS.warning,
      );
    } else {
      const stealAmt = randomInt(2, 5);
      const actualAmt = Math.min(stealAmt, victim.inventory[stealKey] || 0);
      const info     = INGREDIENTS[stealKey];
      victim.inventory[stealKey] = (victim.inventory[stealKey] || 0) - actualAmt;
      victim.markModified('inventory');
      thief.inventory[stealKey] = (thief.inventory[stealKey] || 0) + actualAmt;
      thief.markModified('inventory');
      await Promise.all([thief.save(), victim.save()]);

      embed = bakeryEmbed(
          '🐾 Trộm Thành Công!',
          [
            `Bạn lẻn vào vườn của **${target.displayName}** và...`,
            `> *Bước chân nhẹ nhàng, tay lấy nhanh!* ✨`,
            '',
            `**Trộm được: ${info.emoji} ${info.name} × ${actualAmt}**`,
            '',
            `⏰ Hồi chiêu: \`${formatMs(COOLDOWNS.sneak)}\``,
          ].join('\n'),
          COLORS.success,
      );
    }
  } else if (outcome === 'caught') {
    await thief.save();
    embed = bakeryEmbed(
      '👮 Bị Bắt Gặp!',
      [
        `Bạn lẻn vào vườn của **${target.displayName}** nhưng...`,
        `> *"${target.displayName} quay đầu lại đúng lúc và đuổi bạn ra khỏi vườn!"* 😤`,
        '',
        `May mà bạn chạy kịp, không mất gì cả!`,
        '',
        `⏰ Hồi chiêu: \`${formatMs(COOLDOWNS.sneak)}\``,
      ].join('\n'),
      COLORS.warning,
    );
  } else {
    const loseKey = STEALABLE.find(k => (thief.inventory[k] || 0) > 0);
    await thief.save();

    if (loseKey) {
      const loseAmt = Math.min(randomInt(5, 10), thief.inventory[loseKey]);
      const info    = INGREDIENTS[loseKey];
      thief.inventory[loseKey] = (thief.inventory[loseKey] || 0) - loseAmt;
      thief.markModified('inventory');
      await thief.save();

      embed = bakeryEmbed(
          '🐕 Chó Nhà Người Ta Cắn!',
          [
            `Bạn lẻn vào vườn của **${target.displayName}** nhưng...`,
            `> *Một con chó to đùng lao ra! Bạn bỏ chạy và đánh rơi đồ!* 🐕💨`,
            '',
            `**Mất: ${info.emoji} ${info.name} × ${loseAmt}**`,
            '',
            `⏰ Hồi chiêu: \`${formatMs(COOLDOWNS.sneak)}\``,
          ].join('\n'),
          COLORS.error,
      );
    } else {
      embed = bakeryEmbed(
          '🐕 Chó Nhà Người Ta Cắn!',
          [
            `Bạn lẻn vào vườn của **${target.displayName}** nhưng...`,
            `> *Một con chó to lao ra nhưng may mà bạn không có gì để mất!* 😅`,
            '',
            `⏰ Hồi chiêu: \`${formatMs(COOLDOWNS.sneak)}\``,
          ].join('\n'),
          COLORS.error,
      );
    }
  }
  await sendReply({ embeds: [embed] });
}

// ─── Module export ───────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sneak')
    .setDescription('🐾 Lén vào vườn của người khác để trộm nguyên liệu (có rủi ro!)')
    .addUserOption(o => o
      .setName('muc_tieu')
      .setDescription('Người bạn muốn trộm đồ')
      .setRequired(true)),

  async execute(interaction) {
    const target = interaction.options.getUser('muc_tieu');
    await processSneak(interaction, target);
  },

  async handleComponent(interaction) {
    const parts = interaction.customId.split(':');
    if (parts[1] === 'do') {
      const targetUser = await interaction.client.users.fetch(parts[2]);
      await processSneak(interaction, targetUser, true);
    }
  },
};
