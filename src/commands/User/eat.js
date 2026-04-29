'use strict';
/**
 * @file eat.js
 * @description Ăn bánh từ kho để hồi phục HP cho bản thân.
 */

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const User = require('../../models/User');
const { errorEmbed, successEmbed, bakeryEmbed, selectMenu, row, btn } = require('../../utils/embeds');
const { BAKED_GOODS, BAKED_KEYS, COLORS } = require('../../utils/constants');
const { getItemInfo } = require('../../utils/gameUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eat')
    .setDescription('🍰 Ăn bánh để hồi HP cho bản thân'),

  async executeMessage(message) {
    return message.reply('⚠️ Vui lòng sử dụng tính năng này thông qua Bảng Điều Khiển: `.menu` -> `Hồ Sơ & Kho` -> `Ăn Bánh`.');
  },
  async execute(interaction) {
    return interaction.reply({ content: '⚠️ Vui lòng sử dụng qua Bảng điều khiển trung tâm (`.menu`).', flags: MessageFlags.Ephemeral });
  },

  async handleComponent(interaction) {
    const parts = interaction.customId.split(':');
    const action = parts[1];

    if (action === 'open') {
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      
      if (user.hp >= 100) return interaction.reply({ embeds: [errorEmbed('Bạn đang đầy máu (100 HP), không cần ăn thêm đâu! 🐷')], flags: MessageFlags.Ephemeral });

      const options = BAKED_KEYS.filter(k => (user.inventory[k] || 0) > 0).map(k => {
        const info = BAKED_GOODS[k];
        const heal = info.damage || Math.max(10, Math.floor(info.basePrice / 5)); // Hồi máu = sát thương ném
        return { label: `${info.emoji} ${info.name}`, description: `Hồi ${heal} HP (Có: ${user.inventory[k]})`, value: k };
      });

      if (!options.length) return interaction.reply({ embeds: [errorEmbed('Kho của bạn không có bánh nào để ăn! Hãy nướng thêm nhé. 😱')], flags: MessageFlags.Ephemeral });

      const menu = selectMenu(`eat:consume`, '🍰 Chọn bánh để ăn...', options.slice(0, 25));
      return interaction.update({
        embeds: [bakeryEmbed('🍰 Ăn Bánh Hồi Sức', `❤️ HP hiện tại của bạn: **${Math.floor(user.hp)}/100**\nChọn bánh để nạp lại năng lượng chống bị úp sọt!`, COLORS.success)],
        components: [row(menu), row(btn('menu:section:profile', '◀ Quay Lại', 'Secondary'))]
      });
    }

    if (action === 'consume') {
      await interaction.deferUpdate();
      const itemKey = interaction.values[0];
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const info = getItemInfo(itemKey);

      if (!user.inventory[itemKey] || user.inventory[itemKey] < 1) {
        return interaction.editReply({ embeds: [errorEmbed('Bạn đã hết loại bánh này rồi!')], components: [row(btn('eat:open', '◀ Quay Lại', 'Secondary'))] });
      }

      const heal = info.damage || Math.max(10, Math.floor(info.basePrice / 5));
      user.inventory[itemKey] -= 1;
      user.markModified('inventory');
      user.hp = Math.min(100, user.hp + heal);
      await user.save();

      return interaction.editReply({
        embeds: [bakeryEmbed(
          '😋 Ngon Quá Đi Mất!',
          [
            `Bạn vừa thưởng thức một chiếc **${info.emoji} ${info.name}** vô cùng thơm ngon~ 🌸`,
            `> *Cảm giác năng lượng tuôn trào trong cơ thể!*`,
            '',
            `💚 Hồi phục: **+${heal} HP**`,
            `❤️ Thể lực hiện tại: **${Math.floor(user.hp)}/100**`
          ].join('\n'),
          COLORS.success
        )],
        components: [row(btn('eat:open', '🍰 Tiếp Tục Ăn', 'Primary'), btn('menu:section:profile', '◀ Quay Lại', 'Secondary'))]
      });
    }
  }
};