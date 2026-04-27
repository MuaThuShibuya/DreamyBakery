// 'use strict';
// /**
//  * @file shop.js
//  * @description Lệnh /shop — Cửa hàng trưng bày giữa người chơi với nhau (player-to-player market).
//  *
//  * Tính năng:
//  *  - Duyệt danh sách bánh đang rao bán trong server (có phân trang)
//  *  - Đăng bán bánh qua Modal (popup nhập liệu)
//  *  - Mua bánh từ người khác với xác nhận
//  *  - Listing tự động hết hạn sau 7 ngày (TTL index MongoDB)
//  *
//  * Luồng UX:
//  *  /shop → Embed danh sách + nút [Đăng Bán] [Trang trước] [Trang sau]
//  *  Đăng Bán → Modal 3 ô: tên item, số lượng, giá
//  *  Mua → nút Buy:{id} → Xác nhận → Thực thi giao dịch
//  */

// const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
// const User        = require('../../models/User');
// const ShopListing = require('../../models/ShopListing');
// const { bakeryEmbed, errorEmbed, successEmbed, btn, row } = require('../../utils/embeds');
// const { BAKED_GOODS, COLORS, BAKED_KEYS } = require('../../utils/constants');
// const { getItemInfo, chunkArray } = require('../../utils/gameUtils');

// /** Số listing hiển thị mỗi trang */
// const PER_PAGE = 5;

// // ─── Helpers ────────────────────────────────────────────────────────────────

// /**
//  * Tải danh sách listing của server từ DB với phân trang.
//  * @param {string} guildId
//  * @param {number} page     — 0-indexed
//  * @returns {{ listings: Array, total: number }}
//  */
// async function fetchListings(guildId, page) {
//   const total    = await ShopListing.countDocuments({ guildId });
//   const listings = await ShopListing.find({ guildId })
//     .sort({ createdAt: -1 })
//     .skip(page * PER_PAGE)
//     .limit(PER_PAGE)
//     .lean();
//   return { listings, total };
// }

// /**
//  * Xây embed danh sách cửa hàng.
//  * @param {Array}  listings — Danh sách listing từ DB
//  * @param {number} page     — Trang hiện tại (0-indexed)
//  * @param {number} total    — Tổng số listing
//  */
// function buildShopEmbed(listings, page, total) {
//   const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

//   if (!listings.length) {
//     return bakeryEmbed(
//       `🏬 Cửa Hàng Trưng Bày  (Trang ${page + 1}/${totalPages})`,
//       [
//         `> *Hiện chưa có ai bày bán gì cả...* 🌸`,
//         '',
//         `Hãy là người đầu tiên đăng bán bánh nhé! Bấm **"📦 Đăng Bán"** để bắt đầu.`,
//       ].join('\n'),
//       COLORS.purple,
//     );
//   }

//   const lines = listings.map((l, i) => {
//     const info    = getItemInfo(l.item);
//     const label   = info ? `${info.emoji} ${info.name}` : l.item;
//     const expires = Math.floor(new Date(l.createdAt).getTime() / 1000) + 7 * 24 * 3600;
//     return [
//       `**${page * PER_PAGE + i + 1}.** ${label} × **${l.quantity}**`,
//       `   💰 Giá: **${l.price.toLocaleString('vi-VN')}** xu/cái  |  👤 *${l.sellerName}*`,
//       `   ⏳ Hết hạn: <t:${expires}:R>`,
//     ].join('\n');
//   });

//   return bakeryEmbed(
//     `🏬 Cửa Hàng Trưng Bày  (Trang ${page + 1}/${totalPages})`,
//     [
//       `> *${total} sản phẩm đang được trưng bày trong server* 🍰`,
//       '',
//       lines.join('\n\n'),
//     ].join('\n'),
//     COLORS.purple,
//   );
// }

// /**
//  * Xây hàng nút điều hướng + Đăng Bán + các nút Mua cho từng listing.
//  * @param {Array}  listings
//  * @param {number} page
//  * @param {number} total
//  * @param {string} userId   — ID người xem (ẩn nút Mua của chính mình)
//  */
// function buildShopComponents(listings, page, total, userId) {
//   const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
//   const components = [];

//   // Hàng điều hướng + đăng bán
//   components.push(row(
//     btn(`shop:page:${page - 1}`, '◀ Trước',   'Secondary', page === 0),
//     btn('shop:list_btn',          '📦 Đăng Bán', 'Success'),
//     btn(`shop:page:${page + 1}`, '▶ Tiếp',    'Secondary', page >= totalPages - 1),
//   ));

//   // Nút Mua cho từng listing (mỗi hàng tối đa 5 nút)
//   const buyBtns = listings
//     .filter(l => l.sellerId !== userId)
//     .map((l, i) => btn(`shop:buy:${l._id}`, `Mua #${page * PER_PAGE + i + 1}`, 'Primary'));

//   if (buyBtns.length) {
//     chunkArray(buyBtns, 5).forEach(chunk => components.push(row(...chunk)));
//   }

//   return components;
// }

// // ─── Module export ───────────────────────────────────────────────────────────

// module.exports = {
//   data: new SlashCommandBuilder()
//     .setName('shop')
//     .setDescription('🏬 Cửa hàng trưng bày bánh giữa người chơi'),

//   /** Lệnh gốc: hiển thị trang 0 của shop. */
//   async execute(interaction) {
//     const { listings, total } = await fetchListings(interaction.guildId, 0);
//     await interaction.reply({
//       embeds:     [buildShopEmbed(listings, 0, total)],
//       components: buildShopComponents(listings, 0, total, interaction.user.id),
//     });
//   },

//   /**
//    * Xử lý button / modal submit của /shop.
//    * Patterns:
//    *  shop:page:<n>        — Chuyển trang
//    *  shop:list_btn        — Mở modal đăng bán
//    *  shop:buy:<listingId> — Mua sản phẩm
//    *  shop:confirm_buy:<listingId> — Xác nhận mua
//    */
//   async handleComponent(interaction) {
//     const parts  = interaction.customId.split(':');
//     const action = parts[1];

//     // ── Mở từ menu ──────────────────────────────────────────────────────────
//     if (action === 'open') {
//       const { listings, total } = await fetchListings(interaction.guildId, 0);
//       return interaction.update({
//         embeds:     [buildShopEmbed(listings, 0, total)],
//         components: [...buildShopComponents(listings, 0, total, interaction.user.id), row(btn('menu:home', '◀ Menu', 'Secondary'))],
//       });
//     }

//     // ── Chuyển trang ──────────────────────────────────────────────────────────
//     if (action === 'page') {
//       const page = Math.max(0, parseInt(parts[2]) || 0);
//       await interaction.deferUpdate();
//       const { listings, total } = await fetchListings(interaction.guildId, page);
//       return interaction.editReply({
//         embeds:     [buildShopEmbed(listings, page, total)],
//         components: [...buildShopComponents(listings, page, total, interaction.user.id), row(btn('menu:home', '◀ Menu', 'Secondary'))],
//       });
//     }

//     // ── Mở Modal đăng bán ────────────────────────────────────────────────────
//     if (action === 'list_btn') {
//       const user = await User.findOneAndUpdate(
//         { userId: interaction.user.id, guildId: interaction.guildId },
//         { $setOnInsert: { username: interaction.user.username } },
//         { upsert: true, new: true }
//       );

//       // Chỉ cho phép DEV hoặc người có cờ isShopOwner đăng bán
//       const isDev = interaction.user.id === process.env.DEV_ID;
//       if (!isDev && !user.isShopOwner) {
//         return interaction.reply({ embeds: [errorEmbed('🔒 Bạn không có giấy phép kinh doanh!\nChỉ Nhà Phát Triển hoặc người được cấp quyền mới có thể đăng bán hàng trên Shop Thương Mại.')], ephemeral: true });
//       }

//       // Liệt kê các loại bánh hợp lệ để user biết cần nhập gì
//       const validKeys = [...BAKED_KEYS, ...BAKED_KEYS.map(k => `shiny_${k}`)];
//       const hint      = BAKED_KEYS.slice(0, 3).join(', ') + '...';

//       const modal = new ModalBuilder()
//         .setCustomId('shop:list_modal')
//         .setTitle('📦 Đăng Bán Sản Phẩm');

//       modal.addComponents(
//         new ActionRowBuilder().addComponents(
//           new TextInputBuilder()
//             .setCustomId('item')
//             .setLabel(`Tên sản phẩm (VD: ${hint})`)
//             .setStyle(TextInputStyle.Short)
//             .setPlaceholder('strawberry_cupcake')
//             .setRequired(true),
//         ),
//         new ActionRowBuilder().addComponents(
//           new TextInputBuilder()
//             .setCustomId('quantity')
//             .setLabel('Số lượng muốn bán')
//             .setStyle(TextInputStyle.Short)
//             .setPlaceholder('1')
//             .setMinLength(1).setMaxLength(3)
//             .setRequired(true),
//         ),
//         new ActionRowBuilder().addComponents(
//           new TextInputBuilder()
//             .setCustomId('price')
//             .setLabel('Giá mỗi cái (xu)')
//             .setStyle(TextInputStyle.Short)
//             .setPlaceholder('100')
//             .setMinLength(1).setMaxLength(7)
//             .setRequired(true),
//         ),
//       );

//       return interaction.showModal(modal);
//     }

//     // ── Chọn mua listing → hiện xác nhận ────────────────────────────────────
//     if (action === 'buy') {
//       const listingId = parts[2];
//       const listing   = await ShopListing.findById(listingId).lean();
//       if (!listing) {
//         return interaction.reply({ embeds: [errorEmbed('Sản phẩm không còn tồn tại (có thể đã hết hạn hoặc đã bán)!')], ephemeral: true });
//       }
//       if (listing.sellerId === interaction.user.id) {
//         return interaction.reply({ embeds: [errorEmbed('Bạn không thể mua đồ của chính mình!')], ephemeral: true });
//       }

//       const info    = getItemInfo(listing.item);
//       const label   = info ? `${info.emoji} ${info.name}` : listing.item;
//       const total   = listing.price * listing.quantity;

//       return interaction.update({
//         embeds: [bakeryEmbed(
//           '🛍️ Xác Nhận Mua Hàng',
//           [
//             `${label} × **${listing.quantity}**`,
//             `👤 Người bán: **${listing.sellerName}**`,
//             `💰 Giá: **${listing.price.toLocaleString('vi-VN')}** xu/cái`,
//             `💸 Tổng cộng: **${total.toLocaleString('vi-VN')}** xu`,
//           ].join('\n'),
//           COLORS.gold,
//         )],
//         components: [row(
//           btn(`shop:confirm_buy:${listingId}`, '✅ Xác Nhận Mua', 'Success'),
//           btn('shop:cancel_buy',               '❌ Hủy',          'Danger'),
//         )],
//       });
//     }

//     // ── Xác nhận mua ─────────────────────────────────────────────────────────
//     if (action === 'confirm_buy') {
//       await interaction.deferUpdate();
//       const listingId = parts[2];
//       const listing   = await ShopListing.findById(listingId);
//       if (!listing) return interaction.editReply({ embeds: [errorEmbed('Sản phẩm không còn tồn tại!')], components: [] });

//       const buyer = await User.findOneAndUpdate(
//         { userId: interaction.user.id, guildId: interaction.guildId },
//         { $setOnInsert: { username: interaction.user.username } },
//         { upsert: true, new: true },
//       );

//       const total = listing.price * listing.quantity;
//       if (buyer.coins < total) {
//         return interaction.editReply({ embeds: [errorEmbed(`Không đủ xu! Cần **${total}** xu nhưng chỉ có **${buyer.coins}**.`)], components: [row(btn('shop:open', '◀ Quay Lại Shop', 'Secondary'))] });
//       }

//       // Trừ xu người mua, cộng xu người bán
//       buyer.coins -= total;
//       buyer.inventory[listing.item] = (buyer.inventory[listing.item] || 0) + listing.quantity;
//       buyer.markModified('inventory');
//       buyer.stats.totalSold = (buyer.stats.totalSold || 0); // không cộng totalSold của buyer
//       await buyer.save();

//       // Cộng tiền cho người bán (họ có thể offline)
//       await User.updateOne(
//         { userId: listing.sellerId, guildId: listing.guildId },
//         { $inc: { coins: total, 'stats.totalSold': listing.quantity } },
//       );

//       // Xóa listing
//       await ShopListing.findByIdAndDelete(listingId);

//       const info  = getItemInfo(listing.item);
//       const label = info ? `${info.emoji} ${info.name}` : listing.item;

//       return interaction.editReply({
//         embeds: [successEmbed('🛍️ Mua Thành Công!', [
//           `${label} × **${listing.quantity}**`,
//           `💸 Đã trả: **${total.toLocaleString('vi-VN')}** xu`,
//           `💰 Xu còn lại: **${buyer.coins.toLocaleString('vi-VN')}** xu`,
//           '',
//           `📦 Đã thêm vào kho của bạn!`,
//         ].join('\n'))],
//         components: [row(btn('shop:open', '🛒 Tiếp Tục Mua', 'Primary'), btn('menu:home', '🏠 Trang Chủ', 'Secondary'))],
//       });
//     }

//     // ── Hủy xem listing ──────────────────────────────────────────────────────
//     if (action === 'cancel_buy') {
//       interaction.customId = 'shop:open';
//       return this.handleComponent(interaction);
//     }

//     // ── Gian hàng của tôi ───────────────────────────────────────────────────
//     if (action === 'my') {
//       const myListings = await ShopListing.find({ sellerId: interaction.user.id, guildId: interaction.guildId }).lean();
//       if (!myListings.length) {
//         return interaction.reply({ embeds: [errorEmbed('Bạn đang không có sản phẩm nào được bày bán!')], ephemeral: true });
//       }
//       const lines = myListings.map((l, i) => {
//         const info = getItemInfo(l.item);
//         const label = info ? `${info.emoji} ${info.name}` : l.item;
//         return `**${i+1}.** ${label} × **${l.quantity}** — 💰 **${l.price.toLocaleString('vi-VN')}** xu`;
//       });
      
//       // Nút hủy (hỗ trợ hủy tối đa 5 sản phẩm đầu tiên trên 1 trang để UI gọn)
//       const delBtns = myListings.slice(0, 5).map((l, i) => btn(`shop:del:${l._id}`, `Gỡ #${i+1}`, 'Danger'));
      
//       return interaction.update({
//         embeds: [bakeryEmbed('📦 Quản Lý Cửa Hàng Của Bạn', lines.join('\n\n'), COLORS.purple)],
//         components: delBtns.length ? [row(...delBtns), row(btn('menu:section:shop', '◀ Quay Lại', 'Secondary'))] : [row(btn('menu:section:shop', '◀ Quay Lại', 'Secondary'))],
//       });
//     }

//     // ── Gỡ sản phẩm ──────────────────────────────────────────────────────────
//     if (action === 'del') {
//       const listing = await ShopListing.findOneAndDelete({ _id: parts[2], sellerId: interaction.user.id });
//       if (!listing) return interaction.update({ embeds: [errorEmbed('Sản phẩm không tồn tại hoặc đã được mua!')], components: [] });
      
//       // Trả lại đồ vào kho
//       const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
//       user.inventory[listing.item] = (user.inventory[listing.item] || 0) + listing.quantity;
//       user.markModified('inventory');
//       await user.save();
//       return interaction.update({ embeds: [successEmbed('Đã Gỡ Sản Phẩm', 'Hàng đã được cất lại vào kho của bạn.')], components: [] });
//     }
//   },

//   /**
//    * Xử lý Modal submit khi đăng bán sản phẩm.
//    * @param {ModalSubmitInteraction} interaction
//    */
//   async handleModal(interaction) {
//     if (interaction.customId !== 'shop:list_modal') return;
//     await interaction.deferReply({ ephemeral: true });

//     const itemKey  = interaction.fields.getTextInputValue('item').trim().toLowerCase();
//     const qtyRaw   = interaction.fields.getTextInputValue('quantity').trim();
//     const priceRaw = interaction.fields.getTextInputValue('price').trim();

//     // Validate item
//     const info  = getItemInfo(itemKey);
//     if (!info) {
//       return interaction.editReply({ embeds: [errorEmbed('Tên sản phẩm không hợp lệ!\nBạn có thể nhập ID của nguyên liệu hoặc bánh.')] });
//     }

//     // Validate số lượng và giá
//     const qty   = parseInt(qtyRaw);
//     const price = parseInt(priceRaw);
//     if (isNaN(qty)   || qty   < 1) return interaction.editReply({ embeds: [errorEmbed('Số lượng không hợp lệ!')] });
//     if (isNaN(price) || price < 1) return interaction.editReply({ embeds: [errorEmbed('Giá không hợp lệ!')] });

//     // Kiểm tra kho
//     const user = await User.findOneAndUpdate(
//       { userId: interaction.user.id, guildId: interaction.guildId },
//       { $setOnInsert: { username: interaction.user.username } },
//       { upsert: true, new: true },
//     );

//     const hasQty = user.inventory[itemKey] || 0;
//     if (hasQty < qty) {
//       return interaction.editReply({ embeds: [errorEmbed(`Không đủ hàng! Bạn chỉ có **${hasQty}** ${info.emoji} ${info.name}.`)] });
//     }

//     // Kiểm tra giới hạn listing đang hoạt động
//     const activeCount = await ShopListing.countDocuments({ sellerId: interaction.user.id, guildId: interaction.guildId });
//     if (activeCount >= 10) {
//       return interaction.editReply({ embeds: [errorEmbed('Bạn đang có tối đa **10 listing** rồi! Hãy chờ một số hết hạn hoặc bán hết.')] });
//     }

//     // Trừ hàng từ kho, tạo listing
//     user.inventory[itemKey] -= qty;
//     user.markModified('inventory');
//     await user.save();

//     await ShopListing.create({
//       sellerId:   interaction.user.id,
//       sellerName: interaction.user.displayName || interaction.user.username,
//       guildId:    interaction.guildId,
//       item:       itemKey,
//       isShiny:    itemKey.startsWith('shiny_'),
//       quantity:   qty,
//       price,
//     });

//     const label = info ? `${info.emoji} ${info.name}` : itemKey;
//     await interaction.update({
//       embeds: [successEmbed('📦 Đã Đăng Bán!', [
//         `${label} × **${qty}** với giá **${price.toLocaleString('vi-VN')} xu/cái**`,
//         `💸 Tổng giá trị: **${(qty * price).toLocaleString('vi-VN')}** xu`,
//         '',
//         `Listing sẽ tự hết hạn sau **7 ngày**. Dùng \`/shop\` để xem.`,
//       ].join('\n'))],
//       components: [row(btn('shop:open', '◀ Quay Lại Shop', 'Secondary'))]
//     });
//   },

//   // (Nếu code cũ của bạn có dòng "Gian hàng của tôi" nằm ngoài cặp ngoặc này, hãy XÓA HẾT đi nhé)
// };
