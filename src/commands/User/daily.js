'use strict';
/**
 * @file daily.js
 * @description Lệnh /daily — Điểm danh nhận thưởng hàng ngày.
 */

const { SlashCommandBuilder } = require('discord.js');
const User = require('../../models/User');
const { bakeryEmbed, errorEmbed, successEmbed, btn, row } = require('../../utils/embeds');
const { isNewDay, bakery_add_money, randomInt } = require('../../utils/gameUtils');

async function processDaily(interactionOrMessage, userId, guildId) {
  const user = await User.findOneAndUpdate(
    { userId, guildId },
    { $setOnInsert: { username: interactionOrMessage.member?.displayName || 'Player' } },
    { upsert: true, new: true }
  );

  if (!isNewDay(user.cooldowns.daily)) {
    return { embeds: [errorEmbed('Hôm nay bạn đã điểm danh rồi!\nHãy quay lại vào ngày mai (sau 00:00) nhé. ⏰')] };
  }

  const reward = randomInt(500, 1000);
  await bakery_add_money(userId, guildId, reward);
  
  user.cooldowns.daily = new Date();
  await user.save();

  return { embeds: [successEmbed('🎁 Điểm Danh Thành Công!', `Chào ngày mới! Bạn nhận được **${reward} xu** tiền tiêu vặt!\n💳 Số dư hiện tại: **${(user.coins + reward).toLocaleString('vi-VN')} xu**`)] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('🎁 Điểm danh nhận xu miễn phí mỗi ngày'),

  async executeMessage(message) {
    const reply = await processDaily(message, message.author.id, message.guild.id);
    await message.reply(reply);
  },
  async execute(interaction) {
    const reply = await processDaily(interaction, interaction.user.id, interaction.guildId);
    await interaction.reply({ ...reply, ephemeral: true });
  },
  async handleComponent(interaction) {
    if (interaction.customId === 'daily:claim') {
      const reply = await processDaily(interaction, interaction.user.id, interaction.guildId);
      return interaction.reply({ ...reply, ephemeral: true });
    }
  }
};