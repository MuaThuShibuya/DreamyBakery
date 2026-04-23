'use strict';
/**
 * @file menu.js
 * @description Bảng điều khiển trung tâm (Super App) kết nối mọi tính năng.
 */

const { SlashCommandBuilder } = require('discord.js');
const User = require('../models/User');
const { bakeryEmbed, row, btn, selectMenu, userSelectMenu } = require('../utils/embeds');
const { COLORS } = require('../utils/constants');
const { calcLevel } = require('../utils/gameUtils');
const { petBattle } = require('./pet');

function buildMainMenu(user, member) {
  const lvl = calcLevel(user.exp);
  const embed = bakeryEmbed(
    '📱 BẢNG ĐIỀU KHIỂN TRUNG TÂM',
    [
      `> *Chào mừng trở lại, Chủ Tiệm **${member.displayName || member.username}**!* 🌸`,
      '',
      `👤 **Cấp độ:** ${lvl}  |  💰 **Số dư:** ${user.coins.toLocaleString('vi-VN')} xu`,
      '',
      `Hãy sử dụng menu bên dưới để quản lý toàn bộ Tiệm Bánh của bạn một cách nhanh chóng.`
    ].join('\n'),
    COLORS.primary
  );

  if (member.displayAvatarURL) embed.setThumbnail(member.displayAvatarURL());

  const nav = selectMenu(
    'menu:nav',
    '🌟 Chọn khu vực bạn muốn tới...',
    [
      { label: 'Khu Sản Xuất', description: 'Vườn, Trại, Bếp nướng', value: 'production', emoji: '🌾' },
      { label: 'Khu Thương Mại', description: 'Chợ NPC, Shop, Đơn hàng', value: 'business', emoji: '🏪' },
      { label: 'Hồ Sơ & Kho', description: 'Xem túi đồ, Nâng cấp, Profile', value: 'profile', emoji: '🎒' },
      { label: 'Xã Hội & PvP', description: 'Trộm đồ, Khiêu chiến Pet, Chuyển tiền...', value: 'social', emoji: '⚔️' },
      { label: 'Trại Thú Cưng', description: 'Gacha và Cường hóa linh thú', value: 'pet', emoji: '🐾' }
    ]
  );

  return { embeds: [embed], components: [row(nav)] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('menu')
    .setDescription('📱 Mở Bảng Điều Khiển Trung Tâm của Tiệm Bánh'),

  async executeMessage(message, args) {
    const user = await User.findOneAndUpdate({ userId: message.author.id, guildId: message.guild.id }, { $setOnInsert: { username: message.author.username } }, { upsert: true, new: true });
    await message.reply(buildMainMenu(user, message.member || message.author));
  },

  async execute(interaction) {
    const user = await User.findOneAndUpdate({ userId: interaction.user.id, guildId: interaction.guildId }, { $setOnInsert: { username: interaction.user.username } }, { upsert: true, new: true });
    await interaction.reply(buildMainMenu(user, interaction.member || interaction.user));
  },

  async handleComponent(interaction) {
    const action = interaction.customId.split(':')[1];

    if (action === 'nav') {
      const val = interaction.values[0];
      let embed, buttons;

      if (val === 'production') {
        embed = bakeryEmbed('🌾 Khu Sản Xuất', '> *Quản lý Nông Trại và Bếp Nướng của bạn tại đây!*', COLORS.success);
        buttons = row(btn('garden:open', '🌿 Khu Vườn', 'Success'), btn('farm:open', '🏡 Trang Trại', 'Success'), btn('bake:open', '🧁 Nướng Bánh', 'Primary'), btn('oven:open', '🔥 Lò Nướng', 'Primary'));
      } else if (val === 'business') {
        embed = bakeryEmbed('🏪 Khu Thương Mại', '> *Nơi giao thương và kiếm xu!*', COLORS.gold);
        buttons = row(btn('market:open', '🏪 Chợ NPC', 'Primary'), btn('order:open', '📋 Đơn Hàng', 'Success'), btn('shop:open', '🏬 Shop Người Chơi', 'Primary'));
      } else if (val === 'profile') {
        embed = bakeryEmbed('🎒 Hồ Sơ & Kho', '> *Quản lý tài sản và nâng cấp tiệm bánh!*', COLORS.purple);
        buttons = row(btn('profile:open', '🌸 Hồ Sơ', 'Primary'), btn('inventory:open', '📦 Kho Đồ', 'Primary'), btn('upgrade:open', '⬆️ Nâng Cấp', 'Success'));
      } else if (val === 'social') {
        embed = bakeryEmbed('⚔️ Xã Hội & PvP', '> *Chọn một người chơi từ menu bên dưới để bắt đầu tương tác hoặc khiêu chiến!*', COLORS.warning);
        buttons = row(userSelectMenu('menu:target', '🎯 Chọn một người chơi để tương tác...'));
        const buttons2 = row(btn('top:open', '🏆 Bảng Xếp Hạng', 'Success'), btn('menu:home', '◀ Quay Lại', 'Secondary'));
        return interaction.update({ embeds: [embed], components: [buttons, buttons2] });
      } else if (val === 'pet') {
        // Điều hướng thẳng sang luồng của pet.js
        interaction.customId = 'pet:open';
        const cmd = interaction.client.commands.get('pet');
        return cmd.handleComponent(interaction);
      }

      // Ghép nút Quay Lại vào cuối
      if (!buttons.components.some(c => c.data.custom_id === 'menu:home')) {
      buttons.addComponents(btn('menu:home', '◀ Quay Lại', 'Secondary'));
      }
      return interaction.update({ embeds: [embed], components: [buttons] });
    }

    if (action === 'target') {
      const targetId = interaction.values[0];
      const targetUser = await interaction.client.users.fetch(targetId);
      
      const embed = bakeryEmbed(
        `🎯 Tương tác với: ${targetUser.displayName}`,
        `> Bạn muốn làm gì với **${targetUser.displayName}**?\n\n🐾 **Trộm:** Lẻn vào vườn lấy nguyên liệu.\n⚔️ **Đấu Pet:** Cho thú cưng quyết đấu.\n💸 **Chuyển tiền:** Tặng xu cho họ.`,
        COLORS.warning
      ).setThumbnail(targetUser.displayAvatarURL());

      const btns = row(btn(`sneak:do:${targetId}`, '🐾 Trộm Vườn', 'Primary'), btn(`menu:battle:${targetId}`, '⚔️ Đấu Pet', 'Danger'), btn(`chuyentien:open:${targetId}`, '💸 Chuyển Tiền', 'Success'));
      const backBtn = row(btn('menu:home', '◀ Quay Lại Menu', 'Secondary'));

      return interaction.update({ embeds: [embed], components: [btns, backBtn] });
    }

    // Luồng xử lý PvP Pet vs Pet
    if (action === 'battle') {
      await interaction.deferUpdate();
      const targetId = parts[2];
      if (targetId === interaction.user.id) return interaction.editReply({ embeds: [errorEmbed('Thú cưng không thể đánh nhau với chính nó!')], components: [] });

      const attacker = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const victim = await User.findOne({ userId: targetId, guildId: interaction.guildId });

      if (!victim) return interaction.editReply({ embeds: [errorEmbed('Đối thủ chưa từng chơi game này!')], components: [] });

      const battleResult = await petBattle(attacker, victim);
      if (!battleResult) {
        return interaction.editReply({ embeds: [errorEmbed('Một trong hai người chưa trang bị Thú Cưng! Hãy vào **Trại Thú Cưng** để ấp trứng trước.')], components: [row(btn('menu:home', 'Quay lại', 'Secondary'))] });
      }

      const { aPet, vPet, isWin, aBP, vBP } = battleResult;
      const targetUser = await interaction.client.users.fetch(targetId);

      let msg = `⚔️ **${attacker.username}** đã cử **${aPet.name}** giao chiến với **${vPet.name}** của **${targetUser.displayName}**!\n\n`;
      msg += `🔵 Lực chiến phe bạn: **${aBP}**\n🔴 Lực chiến đối thủ: **${vBP}**\n\n`;
      msg += isWin ? `🏆 **CHIẾN THẮNG!** Thú cưng của bạn đã áp đảo hoàn toàn đối thủ!` : `💀 **THẤT BẠI!** Thú cưng của đối thủ quá mạnh, bạn phải ngậm ngùi rút lui...`;

      return interaction.editReply({
        embeds: [bakeryEmbed('⚔️ Sàn Đấu Linh Thú', msg, isWin ? COLORS.success : COLORS.error)],
        components: [row(btn('menu:home', '◀ Quay Lại Menu', 'Secondary'))]
      });
    }

    if (action === 'home') {
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      return interaction.update(buildMainMenu(user, interaction.member || interaction.user));
    }
  }
};