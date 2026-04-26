'use strict';
/**
 * @file gift.js
 * @description Lệnh /gift — Tặng bánh hoặc nguyên liệu cho bạn bè trong server.
 *
 * Sử dụng autocomplete để người dùng dễ tìm tên vật phẩm
 * dựa trên những gì họ đang có trong kho.
 *
 * Lưu ý: Không thể tặng cho chính mình và không thể tặng quá số lượng trong kho.
 */

const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const User = require('../../models/User');
const { successEmbed, errorEmbed, bakeryEmbed, btn, row, selectMenu } = require('../../utils/embeds');
const { INGREDIENTS, BAKED_GOODS, COLORS, INGR_KEYS, BAKED_KEYS } = require('../../utils/constants');
const { getItemInfo } = require('../../utils/gameUtils');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Lấy tất cả vật phẩm không trống trong kho người dùng để dùng cho autocomplete.
 * @param {Object} inventory — Inventory của user
 * @returns {Array<{name, value}>}
 */
function getInventoryOptions(inventory) {
  const options = [];

  for (const k of INGR_KEYS) {
    const qty = inventory[k] || 0;
    if (qty > 0) {
      const info = INGREDIENTS[k];
      options.push({ name: `${info.emoji} ${info.name} (×${qty})`, value: k });
    }
  }

  for (const k of BAKED_KEYS) {
    const qty      = inventory[k]             || 0;
    const shinyQty = inventory[`shiny_${k}`] || 0;
    const info     = BAKED_GOODS[k];

    if (qty > 0)      options.push({ name: `${info.emoji} ${info.name} (×${qty})`,               value: k             });
    if (shinyQty > 0) options.push({ name: `✨ ${info.name} Thượng Hạng (×${shinyQty})`,          value: `shiny_${k}` });
  }

  return options;
}

/**
 * Lấy vật phẩm theo danh mục cụ thể cho giao diện Select Menu.
 */
function getInventoryCategory(inventory, category) {
  const options = [];
  if (category === 'ing') {
    for (const k of INGR_KEYS) {
      const qty = inventory[k] || 0;
      if (qty > 0) options.push({ name: `${INGREDIENTS[k].emoji} ${INGREDIENTS[k].name} (×${qty})`, value: k });
    }
  } else if (category === 'baked') {
    for (const k of BAKED_KEYS) {
      const qty = inventory[k] || 0;
      if (qty > 0) options.push({ name: `${BAKED_GOODS[k].emoji} ${BAKED_GOODS[k].name} (×${qty})`, value: k });
    }
  } else if (category === 'shiny') {
    for (const k of BAKED_KEYS) {
      const shinyQty = inventory[`shiny_${k}`] || 0;
      if (shinyQty > 0) options.push({ name: `✨ ${BAKED_GOODS[k].name} Thượng Hạng (×${shinyQty})`, value: `shiny_${k}` });
    }
  }
  return options;
}

// ─── Module export ───────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gift')
    .setDescription('🎁 Tặng bánh hoặc nguyên liệu cho bạn bè')
    .addUserOption(o => o
      .setName('nguoi_nhan')
      .setDescription('Người bạn muốn tặng quà')
      .setRequired(true))
    .addStringOption(o => o
      .setName('vat_pham')
      .setDescription('Tên vật phẩm muốn tặng (gõ để tìm kiếm)')
      .setRequired(true)
      .setAutocomplete(true))
    .addIntegerOption(o => o
      .setName('so_luong')
      .setDescription('Số lượng muốn tặng')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(99)),

  /** Thực thi bằng lệnh !gift */
  async executeMessage(message, args) {
    if (args.length < 3) {
      return message.reply({ embeds: [errorEmbed('Sai cú pháp! Vui lòng dùng:\n`.gift @nguoi_nhan [tên_vat_pham] [so_luong]`\nVí dụ: `.gift @BeDao wheat 5`')] });
    }

    const target = message.mentions.users.first();
    if (!target) {
      return message.reply({ embeds: [errorEmbed('Bạn chưa tag người nhận! Ví dụ: `.gift @BeDao wheat 5`')] });
    }

    const qtyStr = args[args.length - 1];
    const qty = parseInt(qtyStr);
    if (isNaN(qty) || qty <= 0) {
      return message.reply({ embeds: [errorEmbed('Số lượng phải là một số hợp lệ lớn hơn 0!')] });
    }

    const itemKey = args.slice(1, args.length - 1).join('_').toLowerCase();

    if (target.id === message.author.id) {
      return message.reply({ embeds: [errorEmbed('Bạn không thể tặng quà cho chính mình! 😅')] });
    }
    if (target.bot) {
      return message.reply({ embeds: [errorEmbed('Không thể tặng quà cho bot!')] });
    }

    const info = getItemInfo(itemKey);
    if (!info) {
      return message.reply({ embeds: [errorEmbed(`Vật phẩm **${itemKey}** không tồn tại! Dùng \`.inventory\` để xem tên đúng.`)] });
    }

    const sender = await User.findOneAndUpdate(
      { userId: message.author.id, guildId: message.guild.id },
      { $setOnInsert: { username: message.author.username } },
      { upsert: true, new: true },
    );

    const has = sender.inventory[itemKey] || 0;
    if (has < qty) {
      return message.reply({ embeds: [errorEmbed(`Không đủ hàng! Bạn chỉ có **${has}** ${info.emoji} **${info.name}**.`)] });
    }

    const receiver = await User.findOneAndUpdate(
      { userId: target.id, guildId: message.guild.id },
      { $setOnInsert: { username: target.username } },
      { upsert: true, new: true },
    );

    sender.inventory[itemKey]   = has - qty;
    sender.markModified('inventory');
    sender.stats.totalGifts     = (sender.stats.totalGifts || 0) + 1;
    await sender.save();

    receiver.inventory[itemKey] = (receiver.inventory[itemKey] || 0) + qty;
    receiver.markModified('inventory');
    await receiver.save();

    const label = info.type === 'shiny' ? `✨ ${BAKED_GOODS[info.baseKey].name} (Thượng Hạng)` : `${info.emoji} ${info.name}`;
    await message.reply({
      embeds: [successEmbed('🎁 Quà Đã Được Gửi!', `${message.author.displayName} đã tặng cho **${target.displayName}**:\n${label} × **${qty}**\n\n> *"Chúc bạn ngon miệng nhé! 🍰"*`)],
    });
  },

  /**
   * Xử lý autocomplete cho trường `vat_pham`.
   * Lọc theo những gì user đang gõ và những gì họ có trong kho.
   */
  async autocomplete(interaction) {
    const user = await User.findOne({
      userId:  interaction.user.id,
      guildId: interaction.guildId,
    }).lean();

    if (!user) return interaction.respond([]);

    const focused  = interaction.options.getFocused().toLowerCase();
    const options  = getInventoryOptions(user.inventory);
    const filtered = options
      .filter(o => o.name.toLowerCase().includes(focused) || o.value.includes(focused))
      .slice(0, 25);

    await interaction.respond(filtered);
  },

  /** Thực thi lệnh /gift sau khi người dùng điền đầy đủ thông tin. */
  async execute(interaction) {
    const target  = interaction.options.getUser('nguoi_nhan');
    const itemKey = interaction.options.getString('vat_pham');
    const qty     = interaction.options.getInteger('so_luong');

    // Không tặng chính mình
    if (target.id === interaction.user.id) {
      return interaction.reply({ embeds: [errorEmbed('Bạn không thể tặng quà cho chính mình! 😅')], ephemeral: true });
    }
    // Không tặng bot
    if (target.bot) {
      return interaction.reply({ embeds: [errorEmbed('Không thể tặng quà cho bot!')], ephemeral: true });
    }

    // Kiểm tra vật phẩm hợp lệ
    const info = getItemInfo(itemKey);
    if (!info) {
      return interaction.reply({ embeds: [errorEmbed('Vật phẩm không tồn tại! Dùng `.inventory` để xem tên đúng.')], ephemeral: true });
    }

    // Kiểm tra kho người tặng
    const sender = await User.findOneAndUpdate(
      { userId: interaction.user.id, guildId: interaction.guildId },
      { $setOnInsert: { username: interaction.user.username } },
      { upsert: true, new: true },
    );

    const has = sender.inventory[itemKey] || 0;
    if (has < qty) {
      return interaction.reply({
        embeds: [errorEmbed(`Không đủ hàng! Bạn chỉ có **${has}** ${info.emoji} **${info.name}**.`)],
        ephemeral: true,
      });
    }

    // Đảm bảo người nhận có tài khoản
    const receiver = await User.findOneAndUpdate(
      { userId: target.id, guildId: interaction.guildId },
      { $setOnInsert: { username: target.username } },
      { upsert: true, new: true },
    );

    // Thực hiện tặng quà
    sender.inventory[itemKey]   = has - qty;
    sender.markModified('inventory');
    sender.stats.totalGifts     = (sender.stats.totalGifts || 0) + 1;
    await sender.save();

    receiver.inventory[itemKey] = (receiver.inventory[itemKey] || 0) + qty;
    receiver.markModified('inventory');
    await receiver.save();

    // Hiển thị kết quả công khai trong channel
    const label = info.type === 'shiny'
      ? `✨ ${BAKED_GOODS[info.baseKey].name} (Thượng Hạng)`
      : `${info.emoji} ${info.name}`;

    await interaction.reply({
      embeds: [successEmbed(
        '🎁 Quà Đã Được Gửi!',
        [
          `${interaction.user.displayName} đã tặng cho **${target.displayName}**:`,
          `${label} × **${qty}**`,
          '',
          `> *"Chúc bạn ngon miệng nhé! 🍰"*`,
        ].join('\n'),
      )],
    });
  },

  async handleComponent(interaction) {
    const parts = interaction.customId.split(':');
    const action = parts[1];

    if (action === 'open') {
      const targetId = parts[2];
      return interaction.update({
        embeds: [bakeryEmbed('🎁 Chọn Danh Mục Quà Tặng', '> *Bạn muốn tặng loại quà gì cho người bạn này?*\n\n**Vui lòng chọn danh mục:**', COLORS.primary)],
        components: [
          row(
            btn(`gift:cat:ing:${targetId}`, '🌾 Nguyên Liệu', 'Primary'),
            btn(`gift:cat:baked:${targetId}`, '🧁 Bánh Thường', 'Primary'),
            btn(`gift:cat:shiny:${targetId}`, '✨ Thượng Hạng', 'Primary')
          ),
          row(btn('gift:start', '◀ Chọn Người Khác', 'Secondary'))
        ]
      });
    }

    if (action === 'cat') {
      const cat = parts[2];
      const targetId = parts[3];
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      
      const options = getInventoryCategory(user.inventory, cat).slice(0, 25);
      if (!options.length) {
        return interaction.update({
          embeds: [errorEmbed('Bạn không có vật phẩm nào trong danh mục này để tặng!')],
          components: [row(btn(`gift:open:${targetId}`, '◀ Chọn Danh Mục Khác', 'Secondary'))]
        });
      }

      const smOptions = options.map(o => ({ label: o.name.substring(0, 100), value: o.value }));
      const menu = selectMenu(`gift:select_item:${targetId}`, '🎁 Chọn món quà muốn tặng...', smOptions);
      
      const catName = cat === 'ing' ? '🌾 Nguyên Liệu' : cat === 'baked' ? '🧁 Bánh Thường' : '✨ Bánh Thượng Hạng';
      return interaction.update({
        embeds: [bakeryEmbed(`🎁 Tặng Quà — ${catName}`, 'Vui lòng chọn món quà bạn muốn trao đi:', COLORS.primary)],
        components: [row(menu), row(btn(`gift:open:${targetId}`, '◀ Chọn Danh Mục Khác', 'Secondary'))]
      });
    }

    if (action === 'select_item') {
      const targetId = parts[2];
      const itemKey = interaction.values[0];
      
      const modal = new ModalBuilder()
        .setCustomId(`gift:modal:${targetId}:${itemKey}`)
        .setTitle('🎁 Nhập Số Lượng Tặng');
      const input = new TextInputBuilder()
        .setCustomId('qty')
        .setLabel('Số lượng muốn tặng')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }
  },

  async handleModal(interaction) {
    const parts = interaction.customId.split(':');
    if (parts[0] === 'gift' && parts[1] === 'modal') {
      const targetId = parts[2];
      const itemKey = parts[3];
      const qty = parseInt(interaction.fields.getTextInputValue('qty'));

      if (isNaN(qty) || qty <= 0) return interaction.reply({ embeds: [errorEmbed('Số lượng không hợp lệ!')], ephemeral: true });
      
      const sender = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const has = sender.inventory[itemKey] || 0;
      if (has < qty) return interaction.reply({ embeds: [errorEmbed('Không đủ hàng trong kho!')], ephemeral: true });

      const receiver = await User.findOneAndUpdate({ userId: targetId, guildId: interaction.guildId }, { $setOnInsert: { username: targetId } }, { upsert: true, new: true });
      sender.inventory[itemKey] -= qty;
      sender.markModified('inventory');
      receiver.inventory[itemKey] = (receiver.inventory[itemKey] || 0) + qty;
      receiver.markModified('inventory');
      await Promise.all([sender.save(), receiver.save()]);

      const info = getItemInfo(itemKey);
      return interaction.update({
        embeds: [successEmbed('🎁 Quà Đã Được Gửi!', `Bạn đã gửi **${qty}** ${info.emoji} **${info.name}**!`)],
        components: [row(btn('menu:section:social', '◀ Quay Lại Xã Hội', 'Secondary'))]
      });
    }
  }
};
