'use strict';
/**
 * @file chuyentien.js
 * @description Lệnh /chuyentien — Chuyển xu cho người chơi khác
 */

const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const User = require('../../models/User');
const { successEmbed, errorEmbed, bakeryEmbed, row, btn, userSelectMenu } = require('../../utils/embeds');
const { resolveUserId } = require('../../utils/targetResolver');
const { COLORS } = require('../../utils/constants');
const { bakery_add_money } = require('../../utils/gameUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('chuyentien')
    .setDescription('💸 Chuyển xu cho người chơi khác')
    .addUserOption(o => o.setName('nguoi_nhan').setDescription('Người nhận').setRequired(true))
    .addIntegerOption(o => o.setName('so_tien').setDescription('Số xu muốn chuyển').setRequired(true).setMinValue(1)),

  async executeMessage(message, args) {
    const targetInput = args[0];
    const amountInput = args[1] || args[args.length - 1];
    
    const targetId = resolveUserId(targetInput);
    const amount = parseInt(amountInput);

    if (!targetId || isNaN(amount) || amount <= 0) {
      return message.reply({ embeds: [errorEmbed('Cú pháp: `.chuyentien <@user/link/ID> <số_xu>`\nVí dụ: `.chuyentien @BeDao 1000`')] });
    }

    if (targetId === message.author.id) {
      return message.reply({ embeds: [errorEmbed('Bạn không thể tự chuyển tiền cho chính mình! 😂')] });
    }
    
    const targetUser = await message.client.users.fetch(targetId).catch(() => null);
    if (!targetUser) return message.reply({ embeds: [errorEmbed('Không tìm thấy người dùng này trong hệ thống!')] });
    if (targetUser.bot) {
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
      { userId: targetId, guildId: message.guild.id },
      { $setOnInsert: { username: targetUser.username } },
      { upsert: true, new: true }
    );

    await bakery_add_money(message.author.id, message.guild.id, -amount);
    await bakery_add_money(targetId, message.guild.id, amount);

    return message.reply({ embeds: [successEmbed(
      '💸 Chuyển Tiền Thành Công!',
      `👤 **${message.author.displayName}** đã chuyển khoản cho **${targetUser.displayName}**:\n💰 **${amount.toLocaleString('vi-VN')} xu**\n\n💳 Số dư hiện tại của bạn: **${sender.coins.toLocaleString('vi-VN')} xu**`
    )] });
  },

  async execute(interaction) {
    // Dành cho gõ /chuyentien tương tự như !chuyentien
    const target = interaction.options.getUser('nguoi_nhan');
    const amount = interaction.options.getInteger('so_tien');

    return interaction.reply({
      content: '⚠️ Vui lòng sử dụng lệnh tiền tố để thực hiện chuyển tiền (VD: `.chuyentien @user 1000`)',
      flags: MessageFlags.Ephemeral
    });
  },

  async handleComponent(interaction) {
    const parts = interaction.customId.split(':');
    if (parts[1] === 'open') {
      const targetId = parts[2];
      if (!targetId) {
        const menu = userSelectMenu('chuyentien:select_target', '🎯 Chọn người chơi muốn chuyển tiền...');
        return interaction.update({
          embeds: [bakeryEmbed('💸 Chuyển Tiền', 'Vui lòng chọn người chơi bạn muốn chuyển tiền từ menu bên dưới:', COLORS.success)],
          components: [row(menu), row(btn('menu:section:bank', '◀ Quay Lại', 'Secondary'))]
        });
      }
      const modal = new ModalBuilder().setCustomId(`chuyentien:modal:${targetId}`).setTitle('💸 Chuyển Tiền');
      const amountInput = new TextInputBuilder().setCustomId('amount').setLabel('Nhập số xu muốn chuyển:').setStyle(TextInputStyle.Short).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
      return interaction.showModal(modal);
    }

    if (parts[1] === 'select_target') {
      const targetId = interaction.values[0];
      if (targetId === interaction.user.id) return interaction.reply({ embeds: [errorEmbed('Không thể tự chuyển cho chính mình!')], flags: MessageFlags.Ephemeral });
      const modal = new ModalBuilder().setCustomId(`chuyentien:modal:${targetId}`).setTitle('💸 Chuyển Tiền');
      const amountInput = new TextInputBuilder().setCustomId('amount').setLabel('Nhập số xu muốn chuyển:').setStyle(TextInputStyle.Short).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
      return interaction.showModal(modal);
    }
  },

  async handleModal(interaction) {
    const parts = interaction.customId.split(':');
    if (parts[1] === 'modal') {
      const targetId = parts[2];
      const amount = parseInt(interaction.fields.getTextInputValue('amount'));
      
      if (isNaN(amount) || amount <= 0) return interaction.reply({ embeds: [errorEmbed('Số tiền không hợp lệ!')], flags: MessageFlags.Ephemeral });
      if (targetId === interaction.user.id) return interaction.reply({ embeds: [errorEmbed('Không thể tự chuyển tiền!')], flags: MessageFlags.Ephemeral });

      const sender = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      if (sender.coins < amount) return interaction.reply({ embeds: [errorEmbed(`Bạn không đủ tiền! Bạn chỉ có **${sender.coins.toLocaleString('vi-VN')}** xu.`)], flags: MessageFlags.Ephemeral });

      const targetUser = await interaction.client.users.fetch(targetId);
      if (targetUser.bot) return interaction.reply({ embeds: [errorEmbed('Bot không xài tiền nha!')], flags: MessageFlags.Ephemeral });

      const receiver = await User.findOneAndUpdate({ userId: targetId, guildId: interaction.guildId }, { $setOnInsert: { username: targetUser.username } }, { upsert: true, new: true });

      await bakery_add_money(interaction.user.id, interaction.guildId, -amount);
      await bakery_add_money(targetId, interaction.guildId, amount);

      return interaction.update({
        embeds: [successEmbed(
          '💸 Chuyển Tiền Thành Công!',
          `👤 Bạn đã chuyển khoản cho **${targetUser.displayName}**:\n💰 **${amount.toLocaleString('vi-VN')} xu**\n\n💳 Số dư hiện tại của bạn: **${sender.coins.toLocaleString('vi-VN')} xu**`
        )],
        components: [row(btn('menu:home', '◀ Menu', 'Secondary'))]
      });
    }
  }
};