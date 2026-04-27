'use strict';
/**
 * @file vay.js
 * @description Lệnh /vay — Hệ thống tín dụng ngân hàng
 */

const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const User = require('../../models/User');
const { bakeryEmbed, errorEmbed, successEmbed, btn, row } = require('../../utils/embeds');
const { bakery_add_money } = require('../../utils/gameUtils');
const { COLORS } = require('../../utils/constants');
const { isDev } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vay')
    .setDescription('🏦 Hệ thống ngân hàng (Vay và Trả nợ)')
    .addSubcommand(sc => sc
      .setName('cap')
      .setDescription('🏦 (Admin) Cho người dùng vay tiền')
      .addUserOption(o => o.setName('nguoi_dung').setDescription('Người vay').setRequired(true))
      .addIntegerOption(o => o.setName('so_tien').setDescription('Số tiền cho vay').setRequired(true))
      .addIntegerOption(o => o.setName('lai_suat').setDescription('Lãi suất (%)').setRequired(true))
    )
    .addSubcommand(sc => sc
      .setName('tra')
      .setDescription('💸 Trả nợ ngân hàng')
      .addIntegerOption(o => o.setName('so_tien').setDescription('Số tiền muốn trả').setRequired(true))
    )
    .addSubcommand(sc => sc
      .setName('thongtin')
      .setDescription('💳 Xem thông tin khoản nợ của bạn')
    ),

  async executeMessage(message, args) {
    const sub = args[0]?.toLowerCase();

    // 1. !vay thongtin
    if (sub === 'thongtin' || sub === 'info') {
      const user = await User.findOne({ userId: message.author.id, guildId: message.guild.id });
      const debt = user?.debt || 0;
      const coins = user?.coins || 0;

      return message.reply({ embeds: [bakeryEmbed(
        '💳 Thông Tin Tín Dụng',
        [
          `👤 **Khách hàng:** ${message.author.displayName}`,
          `💰 **Số dư ví hiện tại:** ${coins.toLocaleString('vi-VN')} xu`,
          `🏦 **Dư nợ ngân hàng:** ${debt.toLocaleString('vi-VN')} xu`,
          '',
          debt > 0 ? `*Dùng \`.vay tra <số_tiền>\` để thanh toán nợ.*` : `*Bạn đang không có khoản nợ nào! Rất tuyệt vời!*`
        ].join('\n'),
        COLORS.primary
      )]});
    }

    // 2. !vay tra <so_tien>
    if (sub === 'tra' || sub === 'pay') {
      const amount = parseInt(args[1]);
      if (isNaN(amount) || amount <= 0) return message.reply({ embeds: [errorEmbed('Số tiền trả không hợp lệ!')] });

      const user = await User.findOneAndUpdate(
        { userId: message.author.id, guildId: message.guild.id },
        { $setOnInsert: { username: message.author.username } },
        { upsert: true, new: true }
      );

      if (user.debt <= 0) return message.reply({ embeds: [errorEmbed('Bạn hiện không có khoản nợ nào để trả!')] });
      if (user.coins < amount) return message.reply({ embeds: [errorEmbed(`Bạn không đủ tiền! Bạn chỉ có **${user.coins.toLocaleString('vi-VN')}** xu.`)] });

      // Không cho phép trả lố số tiền nợ
      const actualPay = Math.min(amount, user.debt);

      await bakery_add_money(message.author.id, message.guild.id, -actualPay);
      user.debt -= actualPay;
      await user.save();

      return message.reply({ embeds: [successEmbed(
        '💸 Thanh Toán Thành Công',
        [
          `Bạn đã trả **${actualPay.toLocaleString('vi-VN')} xu** cho ngân hàng.`,
          `💳 **Dư nợ còn lại:** ${user.debt.toLocaleString('vi-VN')} xu`,
          `💰 **Số dư ví:** ${(user.coins - actualPay).toLocaleString('vi-VN')} xu`
        ].join('\n')
      )]});
    }

    // 3. !vay @user <so_tien> <lai_suat> (DÀNH CHO ADMIN)
    // Nhận diện nếu args đầu tiên là một lượt tag người dùng
    if (message.mentions.users.size > 0) {
      if (!isDev(message.author.id)) {
        return message.reply({ embeds: [errorEmbed('🔒 Lệnh này được mã hóa. Chỉ Nhà Phát Triển (Dev) mới có quyền duyệt khoản vay!')] });
      }

      const target = message.mentions.users.first();
      const amount = parseInt(args[1]);
      const interest = parseInt(args[2]);

      if (isNaN(amount) || amount <= 0) {
        return message.reply({ embeds: [errorEmbed('Cú pháp: `.vay @user <số_tiền> <lãi_suất>`\nVí dụ vay 1000 xu lãi 30%: `.vay @BeDao 1000 30`')] });
      }
      if (isNaN(interest) || interest < 0) {
        return message.reply({ embeds: [errorEmbed('Lãi suất phải là số dương lớn hơn hoặc bằng 0!')] });
      }

      const user = await User.findOneAndUpdate(
        { userId: target.id, guildId: message.guild.id },
        { $setOnInsert: { username: target.username } },
        { upsert: true, new: true }
      );

      // Tính tổng nợ bao gồm cả lãi suất
      const totalDebt = Math.floor(amount + (amount * interest / 100));

      if (user.coins + amount > 1000000000) {
        return message.reply({ embeds: [errorEmbed('Vượt quá giới hạn! Tổng tài sản của người vay không được vượt quá 1 Tỷ Xu.')] });
      }

      await bakery_add_money(target.id, message.guild.id, amount);
      user.debt += totalDebt;
      await user.save();

      return message.reply({ embeds: [successEmbed(
        '🏦 Giải Ngân Thành Công',
        [
          `Đã duyệt khoản vay cho 👤 **${target.displayName}**.`,
          `💵 **Giải ngân (Cộng vào ví):** ${amount.toLocaleString('vi-VN')} xu`,
          `📈 **Lãi suất hợp đồng:** ${interest}%`,
          `🏦 **Tổng ghi nợ:** ${totalDebt.toLocaleString('vi-VN')} xu`,
          '',
          `💳 Ví hiện tại của người vay: **${(user.coins + amount).toLocaleString('vi-VN')} xu**`,
          `*(Khách hàng dùng \`.vay thongtin\` và \`.vay tra\` để quản lý khoản nợ).*`
        ].join('\n')
      )]});
    }

    // Fallback nếu gõ sai cú pháp
    return message.reply({ embeds: [errorEmbed(
      'Cú pháp không hợp lệ.\n\n' +
      '**Dành cho người chơi:**\n' +
      '- Xem nợ: `.vay thongtin`\n' +
      '- Trả nợ: `.vay tra <số_tiền>`\n\n' +
      '**Dành cho Admin:**\n' +
      '- Cấp vay: `.vay @user <số_tiền> <lãi_suất>`'
    )] });
  },

  async execute(interaction) {
    // Dành cho slash command /vay tương tự nếu bạn triển khai nút bấm về sau
    // Để hệ thống đồng bộ, khuyến khích sử dụng Message prefix như bạn đã yêu cầu ở trên
    return interaction.reply({
      content: '⚠️ Vui lòng sử dụng lệnh tiền tố để thực hiện lệnh vay. (VD: `.vay thongtin`, `.vay tra 1000` hoặc Admin gõ `.vay @user 1000 30`)',
      ephemeral: true
    });
  },

  async handleComponent(interaction) {
    const parts = interaction.customId.split(':');
    const action = parts[1];

    if (action === 'open') {
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const debt = user?.debt || 0;
      const coins = user?.coins || 0;

      const embed = bakeryEmbed(
        '💳 Ngân Hàng & Tín Dụng',
        [
          `👤 **Khách hàng:** ${interaction.user.displayName}`,
          `💰 **Số dư ví:** ${coins.toLocaleString('vi-VN')} xu`,
          `🏦 **Dư nợ:** ${debt.toLocaleString('vi-VN')} xu`,
          '',
          debt > 0 ? '*Hãy trả nợ để tránh lãi suất và được tín nhiệm!*' : '*Bạn không có khoản nợ nào. Thật tuyệt vời!*'
        ].join('\n'),
        COLORS.primary
      );

      const btns = row(
        btn('vay:pay_modal', '💸 Thanh Toán Nợ', 'Success', debt <= 0),
        btn('menu:section:trade', '◀ Quay Lại', 'Secondary')
      );

      return interaction.update({ embeds: [embed], components: [btns] });
    }

    if (action === 'pay_modal') {
      const modal = new ModalBuilder()
        .setCustomId('vay:submit_pay')
        .setTitle('💸 Thanh Toán Khoản Nợ');
      const input = new TextInputBuilder()
        .setCustomId('amount')
        .setLabel('Số xu muốn trả')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }
  },

  async handleModal(interaction) {
    if (interaction.customId === 'vay:submit_pay') {
      const amount = parseInt(interaction.fields.getTextInputValue('amount'));
      if (isNaN(amount) || amount <= 0) return interaction.reply({ embeds: [errorEmbed('Số tiền không hợp lệ!')], ephemeral: true });

      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      if (!user || user.debt <= 0) return interaction.reply({ embeds: [errorEmbed('Bạn không có nợ!')], ephemeral: true });
      if (user.coins < amount) return interaction.reply({ embeds: [errorEmbed(`Bạn không đủ tiền! Ví chỉ có **${user.coins.toLocaleString('vi-VN')}** xu.`)], ephemeral: true });

      const actualPay = Math.min(amount, user.debt);
      await bakery_add_money(interaction.user.id, interaction.guildId, -actualPay);
      await User.updateOne({ userId: interaction.user.id, guildId: interaction.guildId }, { $inc: { debt: -actualPay } });

      return interaction.reply({ embeds: [successEmbed('💸 Thanh Toán Thành Công', `Đã trừ **${actualPay.toLocaleString('vi-VN')} xu** vào dư nợ.\nDư nợ còn lại: **${user.debt.toLocaleString('vi-VN')} xu**`)], ephemeral: true });
    }
  }
};