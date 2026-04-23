'use strict';
/**
 * @file bake.js
 * @description Lệnh /bake — Nướng bánh trong lò với luồng UI 4 bước.
 *
 * Luồng tương tác (4 bước):
 *  1. /bake              → Embed + SelectMenu chọn loại bánh (chỉ hiện bánh có đủ NL)
 *  2. Chọn bánh          → Embed chi tiết + nút chọn số lượng (×1, ×3, ×5, ×Max)
 *  3. Chọn số lượng      → Embed xác nhận với chi tiết nguyên liệu và thời gian
 *  4. Xác nhận / Hủy    → Thêm vào hàng đợi lò hoặc hủy
 *
 * Shiny mechanic:
 *  - Roll ngẫu nhiên 1 lần cho cả batch khi xác nhận
 *  - Kết quả shiny được lưu trong bakingJob.isShiny
 *
 * Giới hạn lò: MAX_QUEUE = 5 job đồng thời (đếm theo job chưa xong)
 *
 * State giữa các bước được encode trong customId của button/selectMenu,
 * không cần lưu server-side session.
 */

const { SlashCommandBuilder } = require('discord.js');
const User = require('../models/User');
const { bakeryEmbed, errorEmbed, successEmbed, btn, row, selectMenu } = require('../utils/embeds');
const { BAKED_GOODS, INGREDIENTS, COLORS, UPGRADES } = require('../utils/constants');
const { getAvailableRecipes, maxCanMake, formatMs } = require('../utils/gameUtils');

/** Số job tối đa trong hàng đợi lò cùng lúc */
const MAX_QUEUE = 5;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Xây SelectMenu danh sách bánh user có thể nướng ngay.
 * Mỗi option hiển thị emoji, tên, số lượng tối đa và thời gian nướng.
 * @param {Array} recipes - Kết quả từ getAvailableRecipes(inv)
 * @returns {StringSelectMenuBuilder}
 */
function buildBakeMenu(recipes) {
  const options = recipes.slice(0, 25).map(r => ({
    label:       `${r.emoji} ${r.name}`,
    description: `Tối đa: ${r.maxQty} cái  ·  ${r.bakeTime} phút  ·  ${r.basePrice} xu/cái`,
    value:       r.key,
  }));
  return selectMenu('bake:item_select', '🧁 Chọn loại bánh muốn nướng...', options);
}

/**
 * Xây hàng nút chọn số lượng dựa trên số lượng tối đa có thể làm.
 * Hiển thị các mốc cố định (×1, ×3, ×5) nếu có thể, và nút Max riêng.
 * @param {string} itemKey - Key của loại bánh
 * @param {number} maxQty  - Số lượng tối đa user có thể làm
 * @returns {ActionRowBuilder}
 */
function buildQtyRow(itemKey, maxQty) {
  // Chỉ thêm mốc nếu maxQty đủ lớn, tránh nút bị disable ngay
  const fixed = [1, 3, 5].filter(q => q <= maxQty);
  const btns  = fixed.map(q => btn(`bake:qty:${itemKey}:${q}`, `×${q}`, 'Primary'));

  // Thêm nút Max nếu maxQty không trùng với các mốc cố định
  if (maxQty > 0 && !fixed.includes(maxQty)) {
    btns.push(btn(`bake:qty:${itemKey}:${maxQty}`, `×${maxQty} (Tối đa)`, 'Success'));
  }
  btns.push(btn('bake:cancel', '❌ Hủy', 'Danger'));
  return row(...btns.slice(0, 5)); // Discord giới hạn 5 component mỗi row
}

// ─── Module export ───────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bake')
    .setDescription('🔥 Nướng bánh trong lò'),

  /** Thực thi bằng lệnh !bake */
  async executeMessage(message, args) {
    const user = await User.findOneAndUpdate(
      { userId: message.author.id, guildId: message.guild.id },
      { $setOnInsert: { username: message.author.username } },
      { upsert: true, new: true },
    );

    const activeJobs = (user.bakingQueue || []).filter(j => new Date(j.finishTime) > new Date()).length;
    if (activeJobs >= MAX_QUEUE) {
      return message.reply({
        embeds: [errorEmbed(`Lò nướng đầy! Hàng chờ: **${activeJobs}/${MAX_QUEUE}**.\nDùng \`!oven\` để lấy bánh đã xong trước nhé! 🔥`)],
      });
    }

    const recipes = getAvailableRecipes(user.inventory);
    if (!recipes.length) {
      return message.reply({
        embeds: [errorEmbed('Không đủ nguyên liệu để nướng bất kỳ loại bánh nào!\nDùng `!garden` và `!farm` để thu hoạch thêm nhé 🌿')],
      });
    }

    await message.reply({
      embeds: [bakeryEmbed(
        '🔥 Xưởng Nướng Bánh',
        [
          `> *Lò đang nóng, sẵn sàng phục vụ!* 🧁`,
          '',
          `**🗃️ Hàng đợi lò:** ${activeJobs}/${MAX_QUEUE}`,
          `**🔥 Lò nướng:** Cấp ${user.upgrades.oven || 0} *(giảm ${(user.upgrades.oven || 0) * 10}% thời gian)*`,
          '',
          `Bạn đủ nguyên liệu cho **${recipes.length}** loại bánh:`,
          recipes.map(r => `${r.emoji} **${r.name}** *(tối đa ${r.maxQty} cái)*`).join('\n'),
        ].join('\n'),
        COLORS.warning,
      )],
      components: [row(buildBakeMenu(recipes))],
    });
  },

  /**
   * Bước 1: Hiển thị SelectMenu chọn loại bánh.
   * Kiểm tra hàng đợi đầy và tồn kho trước khi hiển thị.
   */
  async execute(interaction) {
    const user = await User.findOneAndUpdate(
      { userId: interaction.user.id, guildId: interaction.guildId },
      { $setOnInsert: { username: interaction.user.username } },
      { upsert: true, new: true },
    );

    // Đếm số job đang còn nướng (chưa xong)
    const activeJobs = (user.bakingQueue || []).filter(j => new Date(j.finishTime) > new Date()).length;
    if (activeJobs >= MAX_QUEUE) {
      return interaction.reply({
        embeds:    [errorEmbed(`Lò nướng đầy! Hàng chờ: **${activeJobs}/${MAX_QUEUE}**.\nDùng \`!oven\` để lấy bánh đã xong trước nhé! 🔥`)],
        ephemeral: true,
      });
    }

    const recipes = getAvailableRecipes(user.inventory);
    if (!recipes.length) {
      return interaction.reply({
        embeds:    [errorEmbed('Không đủ nguyên liệu để nướng bất kỳ loại bánh nào!\nDùng `!garden` và `!farm` để thu hoạch thêm nhé 🌿')],
        ephemeral: true,
      });
    }

    await interaction.reply({
      embeds: [bakeryEmbed(
        '🔥 Xưởng Nướng Bánh',
        [
          `> *Lò đang nóng, sẵn sàng phục vụ!* 🧁`,
          '',
          `**🗃️ Hàng đợi lò:** ${activeJobs}/${MAX_QUEUE}`,
          `**🔥 Lò nướng:** Cấp ${user.upgrades.oven || 0} *(giảm ${(user.upgrades.oven || 0) * 10}% thời gian)*`,
          '',
          `Bạn đủ nguyên liệu cho **${recipes.length}** loại bánh:`,
          recipes.map(r => `${r.emoji} **${r.name}** *(tối đa ${r.maxQty} cái)*`).join('\n'),
        ].join('\n'),
        COLORS.warning,
      )],
      components: [row(buildBakeMenu(recipes))],
    });
  },

  /**
   * Xử lý toàn bộ SelectMenu và Button trong luồng /bake.
   * customId patterns:
   *  bake:item_select          → SelectMenu chọn item (bước 1→2)
   *  bake:qty:<item>:<n>       → Button chọn số lượng (bước 2→3)
   *  bake:confirm:<item>:<n>   → Button xác nhận nướng (bước 3→kết quả)
   *  bake:cancel               → Button hủy
   */
  async handleComponent(interaction) {
    const parts  = interaction.customId.split(':');
    const action = parts[1];

    // ── Mở từ menu ─────────────────────────────────────────────────────────
    if (action === 'open') {
      const user = await User.findOneAndUpdate(
        { userId: interaction.user.id, guildId: interaction.guildId },
        { $setOnInsert: { username: interaction.user.username } },
        { upsert: true, new: true }
      );
      const activeJobs = (user.bakingQueue || []).filter(j => new Date(j.finishTime) > new Date()).length;
      if (activeJobs >= MAX_QUEUE) {
        return interaction.reply({ embeds: [errorEmbed(`Lò nướng đầy! Hàng chờ: **${activeJobs}/${MAX_QUEUE}**.\nDùng \`!oven\` để lấy bánh đã xong trước nhé! 🔥`)], ephemeral: true });
      }
      const recipes = getAvailableRecipes(user.inventory);
      if (!recipes.length) {
        return interaction.reply({ embeds: [errorEmbed('Không đủ nguyên liệu để nướng bất kỳ loại bánh nào!\nDùng `!garden` và `!farm` để thu hoạch thêm nhé 🌿')], ephemeral: true });
      }
      return interaction.reply({
        embeds: [bakeryEmbed(
          '🔥 Xưởng Nướng Bánh',
          [
            `**🗃️ Hàng đợi lò:** ${activeJobs}/${MAX_QUEUE}`,
            `**🔥 Lò nướng:** Cấp ${user.upgrades.oven || 0}`,
            '',
            `Bạn đủ nguyên liệu cho **${recipes.length}** loại bánh:`
          ].join('\n'), COLORS.warning
        )],
        components: [row(buildBakeMenu(recipes))], ephemeral: true
      });
    }

    // ── Bước 2: Chọn bánh → hiện nút qty ────────────────────────────────────
    if (action === 'item_select') {
      const itemKey  = interaction.values[0];
      const itemData = BAKED_GOODS[itemKey];
      if (!itemData) return interaction.update({ embeds: [errorEmbed('Loại bánh không tồn tại!')], components: [] });

      const user   = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const maxQty = maxCanMake(user.inventory, itemData.recipe);

      if (maxQty === 0) {
        return interaction.update({ embeds: [errorEmbed('Nguyên liệu không còn đủ!')], components: [] });
      }

      // Hiển thị chi tiết công thức cho 1 cái
      const ingrLines = Object.entries(itemData.recipe).map(([k, v]) =>
        `${INGREDIENTS[k].emoji} ${INGREDIENTS[k].name}: **${v}** *(có: ${user.inventory[k] || 0})*`,
      );

      await interaction.update({
        embeds: [bakeryEmbed(
          `${itemData.emoji} ${itemData.name}`,
          [
            `> *${itemData.description}*`,
            '',
            `**📋 Nguyên liệu cho 1 cái:**`,
            ...ingrLines,
            '',
            `✨ **Tỉ lệ Thượng Hạng:** ${(itemData.shinyChance * 100).toFixed(0)}%`,
            '',
            `Chọn số lượng muốn nướng *(tối đa: **${maxQty}** cái)*:`,
          ].join('\n'),
          COLORS.warning,
        )],
        components: [buildQtyRow(itemKey, maxQty)],
      });
    }

    // ── Bước 3: Chọn số lượng → hiện xác nhận ───────────────────────────────
    else if (action === 'qty') {
      const itemKey  = parts[2];
      const qty      = parseInt(parts[3]);
      const itemData = BAKED_GOODS[itemKey];

      const user    = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const canMake = maxCanMake(user.inventory, itemData.recipe);

      if (canMake < qty) {
        return interaction.update({ embeds: [errorEmbed('Nguyên liệu không đủ!')], components: [] });
      }

      // Tính thời gian với bonus lò nướng
      const ovenLvl      = user.upgrades.oven || 0;
      const timeMult     = UPGRADES.oven.timeReduction(ovenLvl);
      const totalMinutes = Math.ceil(itemData.bakeTime * timeMult);

      // Nguyên liệu dùng cho toàn batch
      const ingrLines = Object.entries(itemData.recipe).map(([k, v]) =>
        `${INGREDIENTS[k].emoji} ${INGREDIENTS[k].name}: **${v * qty}** *(có: ${user.inventory[k] || 0})*`,
      );

      const timeNote = ovenLvl > 0
        ? ` *(đã giảm ${100 - Math.round(timeMult * 100)}% nhờ lò cấp ${ovenLvl})*`
        : '';

      await interaction.update({
        embeds: [bakeryEmbed(
          `🔥 Xác Nhận Nướng Bánh`,
          [
            `**${itemData.emoji} ${itemData.name}** × **${qty}**`,
            '',
            `**📋 Nguyên liệu sẽ dùng:**`,
            ...ingrLines,
            '',
            `⏱️ **Thời gian:** ${totalMinutes} phút${timeNote}`,
            `✨ **Tỉ lệ Thượng Hạng:** ${(itemData.shinyChance * 100).toFixed(0)}%`,
            `💰 **Giá bán:** ${itemData.basePrice} xu  *(Thượng Hạng: ${itemData.shinyPrice} xu)*`,
          ].join('\n'),
          COLORS.gold,
        )],
        components: [row(
          btn(`bake:confirm:${itemKey}:${qty}`, '✅ Bắt Đầu Nướng!', 'Success'),
          btn('bake:cancel',                     '❌ Hủy',            'Danger'),
        )],
      });
    }

    // ── Bước 4: Xác nhận → thêm vào hàng đợi ───────────────────────────────
    else if (action === 'confirm') {
      const itemKey  = parts[2];
      const qty      = parseInt(parts[3]);
      const itemData = BAKED_GOODS[itemKey];

      await interaction.deferUpdate();

      const user       = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const activeJobs = (user.bakingQueue || []).filter(j => new Date(j.finishTime) > new Date()).length;

      // Re-validate: hàng đợi có thể đầy nếu user mở nhiều tab
      if (activeJobs >= MAX_QUEUE) {
        return interaction.editReply({ embeds: [errorEmbed('Lò nướng đầy rồi! Dùng `!oven` để lấy bánh trước.')], components: [] });
      }

      // Re-validate: nguyên liệu có thể thay đổi (bị trộm, giao hàng NPC, v.v.)
      const canMake = maxCanMake(user.inventory, itemData.recipe);
      if (canMake < qty) {
        return interaction.editReply({ embeds: [errorEmbed('Nguyên liệu không đủ! Có thể ai đó vừa trộm mất 😱')], components: [] });
      }

      // Trừ nguyên liệu từ kho
      for (const [k, v] of Object.entries(itemData.recipe)) {
        user.inventory[k] = (user.inventory[k] || 0) - v * qty;
      }
      user.markModified('inventory');

      // Roll shiny cho cả batch (1 lần duy nhất)
      const isShiny    = Math.random() < itemData.shinyChance;
      const ovenLvl    = user.upgrades.oven || 0;
      const timeMult   = UPGRADES.oven.timeReduction(ovenLvl);
      const ms         = Math.ceil(itemData.bakeTime * timeMult) * 60_000;
      const finishTime = new Date(Date.now() + ms);

      user.bakingQueue.push({ item: itemKey, quantity: qty, finishTime, isShiny });
      user.stats.totalBaked += qty;
      await user.save();

      await interaction.editReply({
        embeds: [successEmbed(
          '🔥 Đã Thêm Vào Lò Nướng!',
          [
            `${itemData.emoji} **${itemData.name}** × ${qty} đang được nướng~`,
            isShiny ? '✨ *Cảm giác batch này sẽ ra bánh Thượng Hạng!* 🌟' : '',
            '',
            `⏱️ **Bánh xong sau:** \`${formatMs(ms)}\``,
            `📋 Dùng \`!oven\` để theo dõi và lấy bánh!`,
          ].filter(Boolean).join('\n'),
        )],
        components: [],
      });
    }

    // ── Hủy ─────────────────────────────────────────────────────────────────
    else if (action === 'cancel') {
      await interaction.update({
        embeds:     [bakeryEmbed('❌ Đã Hủy', 'Bạn đã hủy việc nướng bánh.', COLORS.error)],
        components: [],
      });
    }
  },
};
