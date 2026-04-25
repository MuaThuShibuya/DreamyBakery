'use strict';
/**
 * @file market.js
 * @description Lệnh /market — Chợ thị trấn cho phép người chơi mua nguyên liệu hiếm
 *              và bán nguyên liệu/bánh cho NPC với giao diện button tương tác.
 *
 * Luồng UX:
 *  1. /market   → Hiển thị embed bảng giá + 2 nút: Mua / Bán
 *  2. Bấm Mua   → SelectMenu chọn item muốn mua
 *  3. Chọn item → Nút số lượng (×1, ×5, ×10, ×Tối đa)
 *  4. Chọn qty  → Xác nhận → Trừ xu, cộng item
 *  5. Bấm Bán   → SelectMenu chọn item trong kho
 *  6. Chọn item → Nút số lượng → Xác nhận → Cộng xu, trừ item
 */

const { SlashCommandBuilder } = require('discord.js');
const User       = require('../../models/User');
const { bakeryEmbed, errorEmbed, successEmbed, btn, row, selectMenu } = require('../../utils/embeds');
const {
  MARKET_PRICES, INGREDIENTS, BAKED_GOODS,
  INGR_KEYS, BAKED_KEYS, COLORS,
} = require('../../utils/constants');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Trả về embed tổng quan bảng giá chợ thị trấn.
 * @returns {EmbedBuilder}
 */
function buildMarketEmbed() {
  const rareLines = ['chocolate', 'vanilla', 'goldpowder'].map(k => {
    const p = MARKET_PRICES[k]; const i = INGREDIENTS[k];
    return `${i.emoji} **${i.name}** — Mua: ${p.buy} xu  •  Bán lại: ${p.sell} xu`;
  });

  const basicLines = INGR_KEYS
    .filter(k => MARKET_PRICES[k] && !['chocolate','vanilla','goldpowder'].includes(k))
    .map(k => {
      const p = MARKET_PRICES[k]; const i = INGREDIENTS[k];
      return `${i.emoji} **${i.name}** — Mua: ${p.buy} xu  •  Bán: ${p.sell} xu`;
    });

  const bakedLines = BAKED_KEYS.map(k => {
    const data = BAKED_GOODS[k];
    const npcPrice = Math.floor(data.basePrice * 0.7);
    return `${data.emoji} **${data.name}** — Bán NPC: ${npcPrice} xu *(70% giá gốc)*`;
  });

  return bakeryEmbed(
    '🏪 Chợ Thị Trấn',
    [
      `> *Nơi trao đổi nguyên liệu và bánh với giá cả hợp lý~* 💫`,
      '',
      `**🛒 Nguyên liệu hiếm** *(chỉ mua từ chợ)*`,
      rareLines.join('\n'),
      '',
      `**🌾 Nguyên liệu cơ bản**`,
      basicLines.join('\n'),
      '',
      `**🧁 Bánh nướng** *(bán cho NPC)*`,
      bakedLines.join('\n'),
    ].join('\n'),
    COLORS.gold,
  );
}

/**
 * Xây SelectMenu danh sách item có thể mua.
 * @returns {StringSelectMenuBuilder}
 */
function buildBuySelect() {
  const options = Object.entries(MARKET_PRICES).map(([k, p]) => {
    const info = INGREDIENTS[k];
    return { label: `${info.emoji} ${info.name}`, description: `Giá: ${p.buy} xu/cái`, value: k };
  });
  return selectMenu('market:buy_item', '🛒 Chọn nguyên liệu muốn mua...', options);
}

/**
 * Xây SelectMenu danh sách item trong kho người chơi có thể bán.
 * @param {Object} inventory — Inventory của user từ DB
 * @returns {StringSelectMenuBuilder|null} null nếu kho trống
 */
function buildSellSelect(inventory) {
  const options = [];

  // Thêm nguyên liệu có trong kho và trong bảng giá chợ
  for (const k of INGR_KEYS) {
    const qty = inventory[k] || 0;
    if (qty > 0 && MARKET_PRICES[k]) {
      const info = INGREDIENTS[k];
      options.push({
        label:       `${info.emoji} ${info.name} (×${qty})`,
        description: `Bán: ${MARKET_PRICES[k].sell} xu/cái`,
        value:       `ing:${k}`,
      });
    }
  }

  // Thêm bánh đã nướng
  for (const k of BAKED_KEYS) {
    const qty      = inventory[k] || 0;
    const shinyQty = inventory[`shiny_${k}`] || 0;
    const data     = BAKED_GOODS[k];
    if (qty > 0) {
      const price = Math.floor(data.basePrice * 0.7);
      options.push({ label: `${data.emoji} ${data.name} (×${qty})`, description: `Bán: ${price} xu/cái`, value: `baked:${k}` });
    }
    if (shinyQty > 0) {
      const price = Math.floor(data.shinyPrice * 0.7);
      options.push({ label: `✨ ${data.name} Thượng Hạng (×${shinyQty})`, description: `Bán: ${price} xu/cái`, value: `shiny:${k}` });
    }
  }

  if (!options.length) return null;
  return selectMenu('market:sell_item', '💰 Chọn vật phẩm muốn bán...', options.slice(0, 25));
}

/**
 * Tạo hàng nút số lượng dùng cho cả luồng Mua và Bán.
 * @param {string} prefix   — 'market:buy_qty' hoặc 'market:sell_qty'
 * @param {string} itemVal  — value của item (ví dụ 'chocolate' hoặc 'baked:layered_cake')
 * @param {number} max      — Số lượng tối đa có thể mua/bán
 */
function buildQtyRow(prefix, itemVal, max) {
  const encoded = encodeURIComponent(itemVal);
  const sizes   = [1, 5, 10].filter(q => q <= max);
  const btns    = sizes.map(q => btn(`${prefix}:${encoded}:${q}`, `×${q}`, 'Primary'));
  if (max > 0 && !sizes.includes(max)) {
    btns.push(btn(`${prefix}:${encoded}:${max}`, `×${max} Max`, 'Success'));
  }
  btns.push(btn('market:cancel', '❌ Hủy', 'Danger'));
  return row(...btns.slice(0, 5));
}

// ─── Module export ───────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('market')
    .setDescription('🏪 Chợ thị trấn — Mua bán nguyên liệu'),

  /** Lệnh gốc: Hiển thị embed chợ và 2 nút chính. */
  async execute(interaction) {
    await interaction.reply({
      embeds:     [buildMarketEmbed()],
      components: [row(
        btn('market:show_buy',  '🛒 Mua Nguyên Liệu', 'Primary'),
        btn('market:show_sell', '💰 Bán Hàng',        'Success'),
      )],
    });
  },

  /**
   * Xử lý toàn bộ button / selectMenu của lệnh /market.
   * customId pattern: market:<action>:<encodedItem?>:<qty?>
   */
  async handleComponent(interaction) {
    const parts  = interaction.customId.split(':');
    const action = parts[1];

    // ── Mở từ menu ──────────────────────────────────────────────────────────
    if (action === 'open') {
      return interaction.reply({
        embeds:     [buildMarketEmbed()],
        components: [row(btn('market:show_buy', '🛒 Mua Nguyên Liệu', 'Primary'), btn('market:show_sell', '💰 Bán Hàng', 'Success'))],
        components: [row(btn('market:show_buy', '🛒 Mua Nguyên Liệu', 'Primary'), btn('market:show_sell', '💰 Bán Hàng', 'Success')), row(btn('menu:section:trade', '◀ Quay Lại', 'Secondary'))],
        ephemeral:  true
      });
    }

    // ── Hiện SelectMenu mua ──────────────────────────────────────────────────
    if (action === 'show_buy') {
      await interaction.update({
        embeds:     [bakeryEmbed('🛒 Mua Nguyên Liệu', '> *Chọn nguyên liệu bạn muốn mua:*', COLORS.gold)],
        components: [row(buildBuySelect()), row(btn('market:back', '◀ Quay Lại', 'Secondary'))],
      });
      return;
    }

    // ── Hiện SelectMenu bán ──────────────────────────────────────────────────
    if (action === 'show_sell') {
      const user   = await User.findOneAndUpdate(
        { userId: interaction.user.id, guildId: interaction.guildId },
        { $setOnInsert: { username: interaction.user.username } },
        { upsert: true, new: true },
      );
      const menu   = buildSellSelect(user.inventory);
      if (!menu) {
        return interaction.update({ embeds: [errorEmbed('Kho của bạn trống! Hãy thu hoạch và nướng bánh trước nhé 🌿')], components: [] });
      }
      await interaction.update({
        embeds:     [bakeryEmbed('💰 Bán Hàng', `> *Bạn có **${user.coins.toLocaleString('vi-VN')} xu**. Chọn vật phẩm muốn bán:*`, COLORS.gold)],
        components: [row(menu), row(btn('market:back', '◀ Quay Lại', 'Secondary'))],
      });
      return;
    }

    // ── Quay lại màn chợ chính ───────────────────────────────────────────────
    if (action === 'back' || action === 'cancel') {
      const hasBack = interaction.message.components.length > 1; // Dòng 2 chứa nút Quay lại Menu
      const comps = [row(btn('market:show_buy', '🛒 Mua Nguyên Liệu', 'Primary'), btn('market:show_sell', '💰 Bán Hàng', 'Success'))];
      if (hasBack) comps.push(row(btn('menu:section:trade', '◀ Quay Lại', 'Secondary')));

      return interaction.update({
        embeds:     [buildMarketEmbed()],
        components: [row(
          btn('market:show_buy',  '🛒 Mua Nguyên Liệu', 'Primary'),
          btn('market:show_sell', '💰 Bán Hàng',        'Success'),
        )],
        components: comps,
      });
    }

    // ── Chọn item muốn mua → hiện nút qty ────────────────────────────────────
    if (action === 'buy_item') {
      const itemKey = interaction.values[0];
      const price   = MARKET_PRICES[itemKey]?.buy;
      if (!price) return interaction.update({ embeds: [errorEmbed('Item không hợp lệ!')], components: [] });

      const user   = await User.findOneAndUpdate(
        { userId: interaction.user.id, guildId: interaction.guildId },
        { $setOnInsert: { username: interaction.user.username } },
        { upsert: true, new: true },
      );
      const info   = INGREDIENTS[itemKey];
      const maxBuy = Math.floor(user.coins / price);

      if (maxBuy === 0) {
        return interaction.update({ embeds: [errorEmbed(`Bạn không đủ xu để mua **${info.name}**!\nCần ít nhất **${price}** xu.`)], components: [] });
      }

      await interaction.update({
        embeds: [bakeryEmbed(
          `🛒 Mua ${info.emoji} ${info.name}`,
          [
            `Giá: **${price} xu/cái**`,
            `Xu của bạn: **${user.coins.toLocaleString('vi-VN')} xu**`,
            `Tối đa có thể mua: **${maxBuy} cái**`,
            '',
            `Chọn số lượng:`,
          ].join('\n'),
          COLORS.gold,
        )],
        components: [buildQtyRow('market:buy_qty', itemKey, Math.min(maxBuy, 99))],
      });
      return;
    }

    // ── Chọn item muốn bán → hiện nút qty ────────────────────────────────────
    if (action === 'sell_item') {
      const val    = interaction.values[0]; // e.g. 'baked:layered_cake' or 'ing:chocolate'
      const [type, itemKey] = val.split(':');
      const user   = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });

      let maxSell, price, label;
      if (type === 'ing') {
        maxSell = user.inventory[itemKey] || 0;
        price   = MARKET_PRICES[itemKey]?.sell || 0;
        label   = `${INGREDIENTS[itemKey].emoji} ${INGREDIENTS[itemKey].name}`;
      } else if (type === 'shiny') {
        maxSell = user.inventory[`shiny_${itemKey}`] || 0;
        price   = Math.floor(BAKED_GOODS[itemKey].shinyPrice * 0.7);
        label   = `✨ ${BAKED_GOODS[itemKey].name} (Thượng Hạng)`;
      } else {
        maxSell = user.inventory[itemKey] || 0;
        price   = Math.floor(BAKED_GOODS[itemKey].basePrice * 0.7);
        label   = `${BAKED_GOODS[itemKey].emoji} ${BAKED_GOODS[itemKey].name}`;
      }

      if (maxSell === 0) return interaction.update({ embeds: [errorEmbed('Bạn không có vật phẩm này!')], components: [] });

      await interaction.update({
        embeds: [bakeryEmbed(
          `💰 Bán ${label}`,
          [`Giá bán: **${price} xu/cái**`, `Số lượng trong kho: **${maxSell}**`, '', `Chọn số lượng muốn bán:`].join('\n'),
          COLORS.gold,
        )],
        components: [buildQtyRow('market:sell_qty', val, Math.min(maxSell, 99))],
      });
      return;
    }

    // ── Xác nhận mua ─────────────────────────────────────────────────────────
    if (action === 'buy_qty') {
      await interaction.deferUpdate();
      const itemKey = decodeURIComponent(parts[2]);
      const qty     = parseInt(parts[3]);
      const price   = MARKET_PRICES[itemKey]?.buy;
      const total   = price * qty;
      const user    = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });

      if (user.coins < total) return interaction.editReply({ embeds: [errorEmbed('Không đủ xu!')], components: [] });

      user.coins           -= total;
      user.inventory[itemKey] = (user.inventory[itemKey] || 0) + qty;
      user.markModified('inventory');
      await user.save();

      const info = INGREDIENTS[itemKey];
      await interaction.editReply({
        embeds: [successEmbed('🛒 Mua Thành Công!', [
          `${info.emoji} **${info.name}** × ${qty}`,
          `💸 Đã trả: **${total.toLocaleString('vi-VN')}** xu`,
          `💰 Xu còn lại: **${user.coins.toLocaleString('vi-VN')}** xu`,
        ].join('\n'))],
        components: [],
      });
      return;
    }

    // ── Xác nhận bán ─────────────────────────────────────────────────────────
    if (action === 'sell_qty') {
      await interaction.deferUpdate();
      const val              = decodeURIComponent(parts[2]);
      const qty              = parseInt(parts[3]);
      const [type, itemKey]  = val.split(':');
      const user             = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });

      let invKey, price, label;
      if (type === 'ing') {
        invKey = itemKey;
        price  = MARKET_PRICES[itemKey]?.sell || 0;
        label  = `${INGREDIENTS[itemKey].emoji} ${INGREDIENTS[itemKey].name}`;
      } else if (type === 'shiny') {
        invKey = `shiny_${itemKey}`;
        price  = Math.floor(BAKED_GOODS[itemKey].shinyPrice * 0.7);
        label  = `✨ ${BAKED_GOODS[itemKey].name} (Thượng Hạng)`;
      } else {
        invKey = itemKey;
        price  = Math.floor(BAKED_GOODS[itemKey].basePrice * 0.7);
        label  = `${BAKED_GOODS[itemKey].emoji} ${BAKED_GOODS[itemKey].name}`;
      }

      const has = user.inventory[invKey] || 0;
      if (has < qty) return interaction.editReply({ embeds: [errorEmbed('Số lượng trong kho không đủ!')], components: [] });

      const earned = price * qty;
      user.inventory[invKey] = has - qty;
      user.markModified('inventory');
      user.coins += earned;
      user.stats.totalSold += type !== 'ing' ? qty : 0;
      await user.save();

      await interaction.editReply({
        embeds: [successEmbed('💰 Bán Thành Công!', [
          `${label} × ${qty}`,
          `💰 Nhận được: **${earned.toLocaleString('vi-VN')}** xu`,
          `💳 Tổng xu: **${user.coins.toLocaleString('vi-VN')}** xu`,
        ].join('\n'))],
        components: [],
      });
    }
  },
};
