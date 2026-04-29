'use strict';
/**
 * @file order.js
 * @description Lệnh /order — Xem và hoàn thành đơn hàng từ khách NPC hàng ngày.
 *
 * Cơ chế:
 *  - Đơn hàng reset mỗi ngày (so sánh ngày hiện tại với dailyOrdersDate)
 *  - Số đơn = 3 (base) + cấp nâng cấp Trang Trí (decor)
 *  - Mỗi đơn yêu cầu X cái bánh → trừ từ inventory → cộng xu + EXP
 *  - NPC không bao giờ yêu cầu bánh Thượng Hạng (giữ đơn giản)
 *
 * Màu nút:
 *  - 🟡 Vàng  (active): Có thể giao ngay
 *  - 🔴 Đỏ   (disabled): Chưa đủ bánh
 *  - ✅       : Đã hoàn thành
 *
 * Có thể mở ephemeral từ nút shortcut trong /profile.
 */

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const User = require('../../models/User');
const { bakeryEmbed, errorEmbed, successEmbed, btn, row } = require('../../utils/embeds');
const { BAKED_GOODS, NPCS, COLORS } = require('../../utils/constants');
const { isNewDay, generateNpcOrders, chunkArray } = require('../../utils/gameUtils');
const { isShopOrAbove } = require('../../utils/permissions');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Lấy hoặc reset đơn hàng NPC cho user.
 * Nếu là ngày mới (isNewDay), tạo đơn hàng mới và lưu vào DB.
 * @param {string} userId
 * @param {string} guildId
 * @returns {Promise<Document>} User document đã được cập nhật
 */
async function fetchOrRefresh(userId, guildId) {
  const user = await User.findOneAndUpdate(
    { userId, guildId },
    { $setOnInsert: { username: 'Player' } },
    { upsert: true, new: true },
  );

  if (isNewDay(user.dailyOrdersDate)) {
    user.dailyOrders     = generateNpcOrders(user.upgrades.decor || 0);
    user.dailyOrdersDate = new Date();
    await user.save();
  }
  return user;
}

/**
 * Xây embed hiển thị tất cả đơn hàng NPC hôm nay.
 * @param {Document} user
 * @returns {EmbedBuilder}
 */
function buildOrderEmbed(user) {
  const orders = user.dailyOrders;
  const done   = orders.filter(o => o.completed).length;

  const sections = orders.map((o, i) => {
    const npc    = NPCS.find(n => n.id === o.npcId) || NPCS[0];
    const item   = BAKED_GOODS[o.item];
    const has    = user.inventory[o.item] || 0;
    const canDo  = !o.completed && has >= o.quantity;

    // Màu icon theo trạng thái đơn hàng
    const status = o.completed ? '✅' : (canDo ? '🟡' : '🔴');

    return [
      `${status} **Đơn ${i + 1}** — ${o.phrase}`,
      `┣ 📦 ${item.emoji} **${item.name}** × ${o.quantity}  *(Trong kho: ${has})*`,
      `┗ 💰 Thưởng: **${o.reward}** xu  +  **${o.expReward}** EXP` +
        (o.completed ? '  ~~(Đã xong)~~' : ''),
    ].join('\n');
  });

  // Thanh tiến độ đơn giản bằng emoji
  const progressBar = '🟣'.repeat(done) + '⬜'.repeat(orders.length - done);

  return bakeryEmbed(
    `📋 Đơn Hàng Hôm Nay`,
    [
      `> *Các khách quen của tiệm đang chờ đơn!* 🌸`,
      '',
      `**Tiến độ:** ${done}/${orders.length}  ${progressBar}`,
      '',
      sections.join('\n\n'),
      '',
      `*Đơn hàng tự động làm mới mỗi ngày lúc 00:00.*`,
    ].join('\n'),
    COLORS.primary,
  );
}

/**
 * Xây các hàng nút "Giao hàng" cho những đơn chưa hoàn thành.
 * Nút disable nếu user chưa có đủ bánh.
 * @param {Array}  orders    - Danh sách đơn hàng
 * @param {Object} inventory - Inventory của user
 * @returns {ActionRowBuilder[]}
 */
function buildDeliverButtons(orders, inventory) {
  const btns = orders.map((o, i) => {
    if (o.completed) return null;
    const has    = inventory[o.item] || 0;
    const canDo  = has >= o.quantity;
    const item   = BAKED_GOODS[o.item];
    return btn(
      `order:deliver:${i}`,
      `Giao #${i + 1} ${item.emoji}`,
      canDo ? 'Success' : 'Secondary',
      !canDo, // disable nếu chưa đủ bánh
    );
  }).filter(Boolean);

  if (!btns.length) return [];
  // Chia thành hàng tối đa 5 nút mỗi hàng
  return chunkArray(btns, 5).map(chunk => row(...chunk));
}

// ─── Module export ───────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('order')
    .setDescription('📋 Xem và hoàn thành đơn hàng từ khách NPC'),

  /** Hiển thị đơn hàng hôm nay khi dùng lệnh. */
  async execute(interaction) {
    const user  = await fetchOrRefresh(interaction.user.id, interaction.guildId);
    if (!isShopOrAbove(interaction.user.id, user)) {
      return interaction.reply({ embeds: [errorEmbed('🔒 Bạn phải là **Chủ Shop** mới có thể nhận và giao đơn hàng NPC!')], flags: MessageFlags.Ephemeral });
    }
    const embed = buildOrderEmbed(user);
    const rows  = buildDeliverButtons(user.dailyOrders, user.inventory);

    await interaction.reply({ embeds: [embed], components: rows });
  },

  /**
   * Xử lý button của /order.
   *  order:open         — Mở ephemeral từ profile shortcut
   *  order:deliver:<i>  — Giao hàng cho đơn thứ i
   */
  async handleComponent(interaction) {
    const parts  = interaction.customId.split(':');
    const action = parts[1];

    const userCheck = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
    if (!isShopOrAbove(interaction.user.id, userCheck)) {
      return interaction.reply({ embeds: [errorEmbed('🔒 Truy cập trái phép! Chỉ Chủ Shop mới được thao tác đơn hàng.')], flags: MessageFlags.Ephemeral });
    }

    // ── Mở ephemeral từ shortcut profile ────────────────────────────────────
    if (action === 'open') {
      const user  = await fetchOrRefresh(interaction.user.id, interaction.guildId);
      const embed = buildOrderEmbed(user);
      const rows  = buildDeliverButtons(user.dailyOrders, user.inventory);
      rows.push(row(btn('menu:section:bakery', '◀ Quay Lại', 'Secondary')));
      return interaction.update({ embeds: [embed], components: rows });
    }

    // ── Giao hàng cho đơn cụ thể ────────────────────────────────────────────
    if (action === 'deliver') {
      await interaction.deferUpdate();
      const idx  = parseInt(parts[2]);
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });

      // Nếu ngày mới trong khi đang xem, reset và load lại đơn
      if (isNewDay(user.dailyOrdersDate)) {
        user.dailyOrders     = generateNpcOrders(user.upgrades.decor || 0);
        user.dailyOrdersDate = new Date();
        await user.save();
        return interaction.editReply({
          embeds:     [buildOrderEmbed(user)],
          components: buildDeliverButtons(user.dailyOrders, user.inventory),
        });
      }

      const order = user.dailyOrders[idx];

      // Validate đơn hàng còn hợp lệ
      if (!order || order.completed) {
        return interaction.editReply({ embeds: [errorEmbed('Đơn hàng không hợp lệ hoặc đã hoàn thành!')], components: [] });
      }

      const has  = user.inventory[order.item] || 0;
      const item = BAKED_GOODS[order.item];

      if (has < order.quantity) {
        return interaction.editReply({
          embeds: [errorEmbed(`Cần **${order.quantity}** ${item.emoji} **${item.name}** nhưng chỉ có **${has}**!\nNướng thêm rồi quay lại nhé~ 🔥`)],
          components: buildDeliverButtons(user.dailyOrders, user.inventory),
        });
      }

      // Thực hiện giao hàng: trừ bánh, cộng xu + EXP, đánh dấu hoàn thành
      user.inventory[order.item]  -= order.quantity;
      user.markModified('inventory');
      user.coins                  += order.reward;
      user.exp                    += order.expReward;
      user.dailyOrders[idx].completed = true;
      user.markModified('dailyOrders');
      user.stats.totalOrders      += 1;
      await user.save();

      const npc = NPCS.find(n => n.id === order.npcId) || NPCS[0];

      await interaction.editReply({
        embeds: [successEmbed(
          `📦 Giao Hàng Thành Công!`,
          [
            `${npc.emoji} **${npc.name}** đã nhận hàng và rất hài lòng!`,
            '',
            `📦 ${item.emoji} **${item.name}** × ${order.quantity}`,
            `💰 **+${order.reward}** xu`,
            `⭐ **+${order.expReward}** EXP`,
            '',
            `💳 Xu hiện có: **${user.coins.toLocaleString('vi-VN')}** xu`,
          ].join('\n'),
        )],
        // Cập nhật lại hàng nút sau khi giao
        components: buildDeliverButtons(user.dailyOrders, user.inventory),
      });
    }
  },
};
