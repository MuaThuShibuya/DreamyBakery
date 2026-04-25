'use strict';
/**
 * @file bomtien.js
 * @description Lệnh /bomtien — Cho phép Dev và những người được chỉ định tự cộng xu vào túi.
 */

const { SlashCommandBuilder } = require('discord.js');
const User = require('../../models/User');
const AdminLog = require('../../models/AdminLog');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { isDev } = require('../../utils/permissions');
const { bakery_add_money } = require('../../utils/gameUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bomtien')
    .setDescription('💸 Quản lý và sử dụng tính năng tự bơm tiền')
    .addSubcommand(sc => sc
      .setName('nhan')
      .setDescription('Nhận tiền vào túi (Dành cho người có quyền)')
      .addIntegerOption(o => o.setName('so_luong').setDescription('Số xu muốn nhận').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sc => sc
      .setName('capquyen')
      .setDescription('Cấp quyền bơm tiền cho người khác (Chỉ Dev)')
      .addUserOption(o => o.setName('nguoi_dung').setDescription('Người được cấp').setRequired(true))
    )
    .addSubcommand(sc => sc
      .setName('tuocquyen')
      .setDescription('Tước quyền bơm tiền (Chỉ Dev)')
      .addUserOption(o => o.setName('nguoi_dung').setDescription('Người bị tước').setRequired(true))
    ),

  async executeMessage(message, args) {
    const sub = args[0]?.toLowerCase();
    
    // Cấp hoặc Tước quyền (Chỉ dành cho Dev)
    if (sub === 'capquyen' || sub === 'tuocquyen') {
      if (!isDev(message.author.id)) {
        return message.reply({ embeds: [errorEmbed('🔒 Chỉ có Nhà Phát Triển (Dev) mới có quyền phân phát tính năng này!')] });
      }
      const target = message.mentions.users.first();
      if (!target) return message.reply({ embeds: [errorEmbed(`Cú pháp: \`.bomtien ${sub} @user\``)] });
      
      const isGranting = sub === 'capquyen';
      const user = await User.findOneAndUpdate(
        { userId: target.id, guildId: message.guild.id },
        { $setOnInsert: { username: target.username } },
        { upsert: true, new: true }
      );
      
      user.canSpawnCoins = isGranting;
      await user.save();
      
      await AdminLog.create({
        adminId: message.author.id,
        adminName: message.author.displayName || message.author.username,
        guildId: message.guild.id,
        action: isGranting ? 'GRANT_SPAWN' : 'REVOKE_SPAWN',
        targetId: target.id,
        details: isGranting ? 'Cấp quyền tự bơm tiền' : 'Tước quyền tự bơm tiền'
      }).catch(() => {});

      return message.reply({ embeds: [successEmbed('✅ Cập Nhật Quyền Thành Công', `Đã **${isGranting ? 'CẤP' : 'TƯỚC'}** quyền tự bơm tiền cho **${target.displayName}**.`)] });
    }

    // Bơm tiền: .bomtien <số lượng> [@user]
    let targetUser = message.author;
    let amountStr = args[0];
    if (message.mentions.users.size > 0) {
      targetUser = message.mentions.users.first();
      amountStr = args[0].includes('<@') ? args[1] : args[0];
    }
    const amount = parseInt(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return message.reply({ embeds: [errorEmbed('Cú pháp hợp lệ:\n- Tự bơm: `.bomtien <số_lượng>`\n- Bơm cho bạn: `.bomtien 1000 @user`\n- Cấp quyền (Dev): `.bomtien capquyen @user`')] });
    }

    const user = await User.findOneAndUpdate(
      { userId: targetUser.id, guildId: message.guild.id },
      { $setOnInsert: { username: targetUser.username } },
      { upsert: true, new: true }
    );

    // Kiểm tra quyền: Phải là Dev HOẶC đã được cấp cờ canSpawnCoins
    if (!isDev(message.author.id) && !user.canSpawnCoins) {
      return message.reply({ embeds: [errorEmbed('🔒 Bạn không được cấp quyền sử dụng lệnh này!')] });
    }

    const newCoins = await bakery_add_money(targetUser.id, message.guild.id, amount);

    await AdminLog.create({
      adminId: message.author.id,
      adminName: message.author.displayName || message.author.username,
      guildId: message.guild.id,
      action: 'SPAWN_COINS',
      targetId: targetUser.id,
      details: `Tự bơm ${amount.toLocaleString('vi-VN')} xu`
    }).catch(() => {});

    return message.reply({ embeds: [successEmbed('💸 Bơm Tiền Thành Công', `Đã bơm **${amount.toLocaleString('vi-VN')} xu** vào tài khoản của **${targetUser.displayName || targetUser.username}**!\n💳 Số dư hiện tại: **${newCoins.toLocaleString('vi-VN')} xu**`)] });
  },

  async execute(interaction) {
    return interaction.reply({
      content: '⚠️ Vui lòng sử dụng lệnh tiền tố để thao tác nhanh hơn (VD: `.bomtien 1000000` hoặc `.bomtien capquyen @user`)',
      ephemeral: true
    });
  }
};