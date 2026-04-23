'use strict';
/**
 * @file chuyentien.js
 * @description Lệnh /chuyentien — Chuyển xu cho người chơi khác
 */

const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const User = require('../models/User');
const { successEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('chuyentien')
    .setDescription('💸 Chuyển xu cho người chơi khác')
    .addUserOption(o => o.setName('nguoi_nhan').setDescription('Người nhận').setRequired(true))
    .addIntegerOption(o => o.setName('so_tien').setDescription('Số xu muốn chuyển').setRequired(true).setMinValue(1)),

  async executeMessage(message, args) {
    const target = message.mentions.users.first();
    const amount = parseInt(args[1] || args[args.length - 1]);

    if (!target || isNaN(amount) || amount <= 0) {
      return message.reply({ embeds: [errorEmbed('Cú pháp: `!chuyentien @user <số_xu>`\nVí dụ: `!chuyentien @BeDao 1000`')] });
    }

    if (target.id === message.author.id) {
      return message.reply({ embeds: [errorEmbed('Bạn không thể tự chuyển tiền cho chính mình! 😂')] });
    }
    if (target.bot) {
      return message.reply({ embeds: [errorEmbed('Bot không cần tiền đâu nha! 🤖')] });
    }

    const sender = await User.findOneAndUpdate(
      { userId: message.author.id, guildId: message.guild.id },
      { $setOnInsert: { username: message.author.username } },
      { upsert: true, new: true }
    );

    if (sender.coins < amount) {
      return message.reply({ embeds: [errorEmbed(`Bạn không đủ tiền! Bạn chỉ có **${sender.coins.toLocaleString('vi-VN')}** xu.`)] });
    }

    const receiver = await User.findOneAndUpdate(
      { userId: target.id, guildId: message.guild.id },
      { $setOnInsert: { username: target.username } },
      { upsert: true, new: true }
    );

    sender.coins -= amount;
    receiver.coins += amount;
    await Promise.all([sender.save(), receiver.save()]);

    return message.reply({ embeds: [successEmbed(
      '💸 Chuyển Tiền Thành Công!',
      `👤 **${message.author.displayName}** đã chuyển khoản cho **${target.displayName}**:\n💰 **${amount.toLocaleString('vi-VN')} xu**\n\n💳 Số dư hiện tại của bạn: **${sender.coins.toLocaleString('vi-VN')} xu**`
    )] });
  },

  async execute(interaction) {
    // Dành cho gõ /chuyentien tương tự như !chuyentien
    const target = interaction.options.getUser('nguoi_nhan');
    const amount = interaction.options.getInteger('so_tien');

    return interaction.reply({
      content: '⚠️ Vui lòng sử dụng lệnh tiền tố để thực hiện chuyển tiền (VD: `!chuyentien @user 1000`)',
      ephemeral: true
    });
  },

  async handleComponent(interaction) {
    const parts = interaction.customId.split(':');
    if (parts[1] === 'open') {
      const targetId = parts[2];
      const modal = new ModalBuilder().setCustomId(`chuyentien:modal:${targetId}`).setTitle('💸 Chuyển Tiền');
      const amountInput = new TextInputBuilder().setCustomId('amount').setLabel('Nhập số xu muốn chuyển:').setStyle(TextInputStyle.Short).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
      return interaction.showModal(modal);
    }
  },

  async handleModal(interaction) {
    const parts = interaction.customId.split(':');
    if (parts[1] === 'modal') {
      await interaction.deferUpdate();
      const targetId = parts[2];
      const amount = parseInt(interaction.fields.getTextInputValue('amount'));
      
      if (isNaN(amount) || amount <= 0) return interaction.editReply({ embeds: [errorEmbed('Số tiền không hợp lệ!')], components: [] });
      if (targetId === interaction.user.id) return interaction.editReply({ embeds: [errorEmbed('Không thể tự chuyển tiền!')], components: [] });

      const sender = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      if (sender.coins < amount) return interaction.editReply({ embeds: [errorEmbed(`Bạn không đủ tiền! Bạn chỉ có **${sender.coins.toLocaleString('vi-VN')}** xu.`)], components: [] });

      const targetUser = await interaction.client.users.fetch(targetId);
      if (targetUser.bot) return interaction.editReply({ embeds: [errorEmbed('Bot không xài tiền nha!')], components: [] });

      const receiver = await User.findOneAndUpdate({ userId: targetId, guildId: interaction.guildId }, { $setOnInsert: { username: targetUser.username } }, { upsert: true, new: true });

      sender.coins -= amount;
      receiver.coins += amount;
      await Promise.all([sender.save(), receiver.save()]);

      return interaction.editReply({
        embeds: [successEmbed(
          '💸 Chuyển Tiền Thành Công!',
          `👤 Bạn đã chuyển khoản cho **${targetUser.displayName}**:\n💰 **${amount.toLocaleString('vi-VN')} xu**\n\n💳 Số dư hiện tại của bạn: **${sender.coins.toLocaleString('vi-VN')} xu**`
        )],
        components: []
      });
    }
  }
};