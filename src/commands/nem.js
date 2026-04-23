'use strict';

const { SlashCommandBuilder } = require('discord.js');
const User = require('../models/User');
const { errorEmbed, bakeryEmbed, selectMenu, row } = require('../utils/embeds');
const { BAKED_GOODS, COLORS, BAKED_KEYS } = require('../utils/constants');
const { getItemInfo } = require('../utils/gameUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nem')
    .setDescription('🎯 Chọi bánh vào mặt người khác để cướp xu!'),

  async executeMessage(message, args) {
    const target = message.mentions.users.first();
    const itemKey = args[1]?.toLowerCase();

    if (!target || !itemKey) {
      return message.reply({ embeds: [errorEmbed('Cú pháp: `!nem @user <loại_bánh>`\nVí dụ: `!nem @BeDao strawberry_cupcake`')] });
    }

    if (target.id === message.author.id) return message.reply({ embeds: [errorEmbed('Tự kỷ à? Đừng tự ném bánh vào mặt mình chứ! 🤡')] });
    if (target.bot) return message.reply({ embeds: [errorEmbed('Bot làm bằng kim loại, ném bánh vô ích thôi! 🤖')] });

    const cakeInfo = BAKED_GOODS[itemKey];
    if (!cakeInfo) return message.reply({ embeds: [errorEmbed(`Loại bánh **${itemKey}** không hợp lệ!\nDùng \`!cookbook\` để xem danh sách bánh.`)] });

    const attacker = await User.findOneAndUpdate(
      { userId: message.author.id, guildId: message.guild.id },
      { $setOnInsert: { username: message.author.username } },
      { upsert: true, new: true }
    );

    if (!attacker.inventory[itemKey] || attacker.inventory[itemKey] < 1) {
      return message.reply({ embeds: [errorEmbed(`Bạn không có cái **${cakeInfo.emoji} ${cakeInfo.name}** nào trong kho để ném!\nHãy nướng thêm hoặc mua từ Shop!`)] });
    }

    const victim = await User.findOneAndUpdate(
      { userId: target.id, guildId: message.guild.id },
      { $setOnInsert: { username: target.username } },
      { upsert: true, new: true }
    );

    // Tiêu hao đạn (bánh)
    attacker.inventory[itemKey] -= 1;
    attacker.markModified('inventory');

    // Gây sát thương
    const damage = cakeInfo.damage;
    victim.hp -= damage;

    let resultMsg = `💥 **BỐP!** 💥\n👤 **${message.author.displayName}** đã chọi một cái **${cakeInfo.emoji} ${cakeInfo.name}** vào mặt **${target.displayName}**!\n📉 Gây **${damage}** sát thương.`;
    let embedColor = COLORS.warning;

    // Nếu nạn nhân hết HP -> Bị cướp tiền
    if (victim.hp <= 0) {
      const stolenAmount = Math.floor(victim.coins * 0.1); // Cướp 10% tiền
      
      if (stolenAmount > 0) {
        victim.coins -= stolenAmount;
        attacker.coins += stolenAmount;
        resultMsg += `\n\n💀 **${target.displayName}** đã kiệt sức và làm rơi **${stolenAmount.toLocaleString('vi-VN')} xu**!\n💸 **${message.author.displayName}** đã nhặt được số tiền này!`;
      } else {
        resultMsg += `\n\n💀 Tiệm của **${target.displayName}** đã nát bươm, nhưng do họ quá nghèo nên bạn chẳng cướp được đồng nào!`;
      }

      victim.hp = 100; // Reset máu sau khi bị "úp sọt"
      embedColor = COLORS.error;
    } else {
      resultMsg += `\n\n❤️ HP còn lại của ${target.displayName}: **${victim.hp}/100**\n*(Hãy dùng \`!eat\` để bơm máu kẻo bị cướp!)*`;
    }

    await Promise.all([attacker.save(), victim.save()]);

    return message.reply({ embeds: [bakeryEmbed('🎯 Đại Chiến Bánh Ngọt', resultMsg, embedColor)] });
  },

  async execute(interaction) {
    return interaction.reply({
      content: '⚠️ Vui lòng sử dụng lệnh tiền tố để ném bánh (VD: `!nem @user strawberry_cupcake`)',
      ephemeral: true
    });
  },

  async handleComponent(interaction) {
    const parts = interaction.customId.split(':');
    const action = parts[1];

    if (action === 'open') {
      const targetId = parts[2];
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      
      const options = BAKED_KEYS.filter(k => (user.inventory[k] || 0) > 0).map(k => {
        const info = BAKED_GOODS[k];
        return { label: `${info.emoji} ${info.name}`, description: `Sát thương: ${info.damage} HP (Có: ${user.inventory[k]})`, value: k };
      });

      if (!options.length) return interaction.update({ embeds: [errorEmbed('Kho của bạn không có bánh nào để ném! 😱')], components: [] });

      const menu = selectMenu(`nem:throw:${targetId}`, '🎯 Chọn đạn (bánh) để ném...', options);
      return interaction.update({
        embeds: [bakeryEmbed('🎯 Sẵn Sàng Chiến Đấu', 'Chọn loại bánh bạn muốn chọi vào mặt đối thủ!', COLORS.warning)],
        components: [row(menu)]
      });
    }

    if (action === 'throw') {
      await interaction.deferUpdate();
      const targetId = parts[2];
      const itemKey = interaction.values[0];
      const targetUser = await interaction.client.users.fetch(targetId);

      if (targetId === interaction.user.id) return interaction.editReply({ embeds: [errorEmbed('Không thể tự ném chính mình!')], components: [] });
      if (targetUser.bot) return interaction.editReply({ embeds: [errorEmbed('Bot không có cảm giác đâu nha!')], components: [] });

      const attacker = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const victim = await User.findOneAndUpdate({ userId: targetId, guildId: interaction.guildId }, { $setOnInsert: { username: targetUser.username } }, { upsert: true, new: true });
      const cakeInfo = BAKED_GOODS[itemKey];

      if (!attacker.inventory[itemKey] || attacker.inventory[itemKey] < 1) {
        return interaction.editReply({ embeds: [errorEmbed('Bạn hết loại bánh này rồi!')], components: [] });
      }

      attacker.inventory[itemKey] -= 1;
      attacker.markModified('inventory');
      victim.hp -= cakeInfo.damage;

      let resultMsg = `💥 **BỐP!** 💥\n👤 **${interaction.user.displayName}** đã chọi một cái **${cakeInfo.emoji} ${cakeInfo.name}** vào mặt **${targetUser.displayName}**!\n📉 Gây **${cakeInfo.damage}** sát thương.`;
      let embedColor = COLORS.warning;

      if (victim.hp <= 0) {
        const stolenAmount = Math.floor(victim.coins * 0.1);
        if (stolenAmount > 0) {
          victim.coins -= stolenAmount;
          attacker.coins += stolenAmount;
          resultMsg += `\n\n💀 **${targetUser.displayName}** đã kiệt sức và làm rơi **${stolenAmount.toLocaleString('vi-VN')} xu**!\n💸 Bạn đã nhặt được!`;
        } else {
          resultMsg += `\n\n💀 Đối thủ đã kiệt sức, nhưng họ không có xu nào để cướp!`;
        }
        victim.hp = 100;
        embedColor = COLORS.error;
      } else {
        resultMsg += `\n\n❤️ HP còn lại của đối thủ: **${victim.hp}/100**`;
      }

      await Promise.all([attacker.save(), victim.save()]);
      return interaction.editReply({ embeds: [bakeryEmbed('🎯 Đại Chiến Bánh Ngọt', resultMsg, embedColor)], components: [] });
    }
  }
};