'use strict';
/**
 * @file menu.js
 * @description Bảng Điều Khiển Trung Tâm — phân vai trò Dev / Shop / User.
 *
 * Kiến trúc:
 *  - Một tin nhắn duy nhất, mọi điều hướng cập nhật realtime qua interaction.update()
 *  - Ba vai trò: Dev (toàn quyền) / Shop (chủ cửa hàng) / User (cơ bản)
 *  - Dev Panel dùng modal để nhập tham số (hỗ trợ @mention, ID, link người dùng)
 */

const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
} = require('discord.js');

const User        = require('../../models/User');
const ShopListing = require('../../models/ShopListing');
const AdminLog    = require('../../models/AdminLog');
const { bakeryEmbed, errorEmbed, successEmbed, btn, row, selectMenu, userSelectMenu } = require('../../utils/embeds');
const { COLORS, ALL_ITEM_KEYS, UPGRADES }   = require('../../utils/constants');
const { calcLevel, getItemInfo, levelProgress, progressBar, getLevelTitle, expForLevel } = require('../../utils/gameUtils');
const { ROLE, getRole, isDev, isShopOrAbove } = require('../../utils/permissions');
const { resolveUserId }            = require('../../utils/targetResolver');
const { refreshMenuTimeout }       = require('../../utils/gameUtils');
const { petBattleEngine }          = require('../User/pet');

// ─── Home Screen ──────────────────────────────────────────────────────────────

function buildMenu(user, member, role, category = 'home') {
  const options = [
    { label: '🏠 Trang Chủ', description: 'Tổng quan tài khoản', value: 'home' },
    { label: '👤 Hồ Sơ & Kho', description: 'Xem thông tin, túi đồ và nâng cấp', value: 'profile' },
    { label: '🌿 Khu Sinh Thái', description: 'Trồng trọt, chăn nuôi thu nguyên liệu', value: 'harvest' },
    { label: '🛒 Thương Mại', description: 'Chợ NPC, ngân hàng, chuyển khoản', value: 'trade' },
    { label: '🎮 Xã Hội & Giải Trí', description: 'Thú cưng, PvP, bảng xếp hạng', value: 'social' },
    { label: '🏬 Khu Vực Kinh Doanh', description: 'Nướng bánh, đơn hàng, quản lý shop', value: 'shop' },
  ];

  if (role === ROLE.DEV) {
    options.push({ label: '🔧 Bảng Điều Khiển Dev', description: 'Quản trị hệ thống', value: 'dev' });
  }

  const navMenu = new StringSelectMenuBuilder()
    .setCustomId('menu:nav')
    .setPlaceholder('📂 Chọn khu vực quản lý...')
    .addOptions(options);

  let embed, btnRows = [];

  if (category === 'home') {
    const lvl = calcLevel(user.exp);
    const { pct } = levelProgress(user.exp, lvl);
    const roleBadge = role === ROLE.DEV ? '👑 Dev' : role === ROLE.SHOP ? '🏬 Chủ Shop' : '🌱 Nông Dân';
    
    embed = bakeryEmbed(
      '🍰 DREAMY BAKERY — BẢNG ĐIỀU KHIỂN',
      [
        `> Chào mừng trở lại, **${member.displayName || member.username}**! *(${roleBadge})*`,
        '',
        `💰 **Ví:** \`${user.coins.toLocaleString('vi-VN')}\` xu`,
        `⭐ **Cấp ${lvl}:** ${progressBar(pct, 10)} ${pct}%`,
        `❤️ **HP:** ${Math.floor(user.hp)}/100`,
        '',
        `Sử dụng **Danh sách thả xuống** bên dưới để duyệt qua các tính năng của Tiệm Bánh.`,
        '',
        `> 💡 **Mẹo:** Đừng quên điểm danh mỗi ngày và thu hoạch đúng giờ nhé!`,
      ].join('\n'),
      role === ROLE.DEV ? COLORS.gold : role === ROLE.SHOP ? COLORS.purple : COLORS.primary
    );
    if (member.displayAvatarURL) embed.setThumbnail(member.displayAvatarURL());
    
    // Hàng nút thao tác nhanh ngoài Trang chủ
    btnRows.push(row(
      btn('daily:claim', '🎁 Điểm Danh', 'Success'),
      btn('inventory:open', '📦 Kho Đồ', 'Primary'),
      btn('garden:open', '🌿 Ra Vườn', 'Primary')
    ));
  }
  else if (category === 'profile') {
    const level = calcLevel(user.exp);
    const { progress, needed, pct } = levelProgress(user.exp, level);
    const title = getLevelTitle(level);

    let descLines = [
      `> *${title}* ✨`,
      '',
      `✨ **EXP:** ${progress} / ${needed}  *(Tổng: ${user.exp})*`,
      '',
    ];

    if (role === ROLE.SHOP || role === ROLE.DEV) {
      descLines.push(
        `**🏪 Kinh doanh & Sản xuất**`,
        `🧁 Đã nướng: **${user.stats.totalBaked}**  •  💸 Đã bán: **${user.stats.totalSold}**  •  📋 Đơn NPC: **${user.stats.totalOrders}**`,
        `🔥 Lò: Cấp ${user.upgrades.oven || 0}/5  •  🌸 Trang trí: Cấp ${user.upgrades.decor || 0}/5`,
        ''
      );
    }
    descLines.push(
      `**🔧 Nâng cấp sinh thái**`,
      `🌿 Vườn: Cấp ${user.upgrades.garden || 0}/5  •  🏡 Trại: Cấp ${user.upgrades.farm || 0}/5`,
      '',
      `**🎮 Hoạt động xã hội**`,
      `🎁 Tặng: **${user.stats.totalGifts}**  •  🐾 Trộm: **${user.stats.totalSneaks}**  •  ⚔️ Thắng: **${user.stats.pvpWins || 0}**`
    );

    embed = bakeryEmbed(`👤 Hồ Sơ Của ${member.displayName || member.username}`, descLines.join('\n'), COLORS.primary);
    if (member.displayAvatarURL) embed.setThumbnail(member.displayAvatarURL());
    
    btnRows.push(row(
      btn('inventory:open', '📦 Mở Kho Đồ', 'Primary'),
      btn('upgrade:open', '⬆️ Nâng Cấp Tiệm', 'Success'),
      btn('eat:open', '🍰 Ăn Bánh (Hồi HP)', 'Secondary')
    ));
  }
  else if (category === 'harvest') {
    embed = bakeryEmbed('🌿 Khu Sinh Thái', '> *Thu hoạch nguyên liệu tươi sạch mỗi ngày.*\n\n> 💡 *Mẹo: Nâng cấp Vườn và Trại để tăng sản lượng!*', COLORS.success);
    btnRows.push(row(btn('garden:open', '🌿 Thu Hoạch Vườn (30p)', 'Success'), btn('farm:open', '🏡 Thu Hoạch Trại (1h)', 'Success')));
  }
  else if (category === 'trade') {
    if (role === ROLE.USER) {
      embed = bakeryEmbed('🏪 Khu Thương Mại', '> *Mua bán nguyên liệu, chuyển khoản và vay vốn tín dụng.*\n\n> 🔒 **Lưu ý:** Bạn cần Giấy Phép Chủ Shop để mở khóa Lò nướng và Bán hàng.', COLORS.gold);
      btnRows.push(row(btn('market:open', '🏪 Chợ NPC', 'Primary'), btn('chuyentien:open', '💸 Chuyển Tiền', 'Success'), btn('vay:open', '💳 Ngân Hàng', 'Secondary')));
    } else {
      embed = bakeryEmbed('🏪 Thương Mại & Kinh Doanh', '> *Nơi tạo ra những chiếc bánh hảo hạng, mua bán và làm giàu!*', COLORS.gold);
      btnRows.push(row(btn('market:open', '🏪 Chợ NPC', 'Primary'), btn('chuyentien:open', '💸 Chuyển Tiền', 'Success'), btn('vay:open', '💳 Ngân Hàng', 'Secondary')));
      btnRows.push(row(btn('bake:open', '🧁 Nướng Bánh', 'Primary'), btn('oven:open', '🔥 Lò Nướng', 'Danger'), btn('cookbook:open', '📖 Công Thức', 'Secondary')));
      btnRows.push(row(btn('order:open', '📋 Giao Đơn NPC', 'Primary'), btn('shop:open', '🏬 Shop Người Chơi', 'Success')));
    }
  }
  else if (category === 'social') {
    embed = bakeryEmbed('🎮 Xã Hội & Giải Trí', '> *Tương tác với bạn bè, nuôi thú cưng và thi đấu!*\n\nChọn một người chơi từ danh sách để tương tác trực tiếp:', COLORS.warning);
    btnRows.push(row(userSelectMenu('menu:target', '🎯 Chọn người chơi để tương tác...')));
    btnRows.push(row(btn('pet:open', '🐾 Trại Thú Cưng', 'Success'), btn('top:open', '🏆 Bảng Xếp Hạng', 'Secondary')));
  }
  else if (category === 'dev') {
    embed = bakeryEmbed('🔧 Dev Panel', '> *Bảng điều khiển hệ thống tối cao.*', COLORS.gold);
    // Gộp nút Dev lại thành 3 hàng để tránh lỗi Discord "Must be 5 or fewer"
    btnRows.push(row(btn('menu:dev:give', '🎁 Tặng Đồ', 'Primary'), btn('menu:dev:coins', '💰 Chỉnh Xu', 'Primary'), btn('menu:dev:exp', '⭐ Cộng EXP', 'Primary'), btn('menu:dev:setshop', '🏬 Cấp Shop', 'Success')));
    btnRows.push(row(btn('menu:dev:ban', '🔨 Ban', 'Danger'), btn('menu:dev:unban', '✅ Bỏ Cấm', 'Success'), btn('menu:dev:stats', '📊 Thống Kê', 'Secondary'), btn('menu:dev:broadcast', '📢 Broadcast', 'Secondary')));
    btnRows.push(row(btn('menu:dev:resetcd', '🔄 Reset CD', 'Secondary'), btn('menu:dev:reset', '⚠️ Xóa Dữ Liệu', 'Danger')));
  }

  // Luôn có nút Trang Chủ và Đóng
  const footerRow = category === 'home' 
    ? row(btn('menu:close', '❌ Đóng Bảng Điều Khiển', 'Danger'))
    : row(btn('menu:home', '🏠 Trang Chủ', 'Secondary'), btn('menu:close', '❌ Đóng', 'Danger'));

  btnRows.push(footerRow);
  return { embeds: [embed], components: [row(navMenu), ...btnRows] };
}

// ─── Dev Modal Builders ───────────────────────────────────────────────────────

function makeTargetInput() {
  return new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('target')
      .setLabel('Người dùng (@mention / ID / discord.com/users/...)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('@username hoặc 123456789012345678'),
  );
}

const DEV_MODALS = {
  give: () => new ModalBuilder()
    .setCustomId('menu:modal:give')
    .setTitle('🎁 Tặng Vật Phẩm')
    .addComponents(
      makeTargetInput(),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('item').setLabel('Tên vật phẩm (VD: wheat, shiny_cheesecake)').setStyle(TextInputStyle.Short).setRequired(true),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('qty').setLabel('Số lượng (1–9999)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('1'),
      ),
    ),

  coins: () => new ModalBuilder()
    .setCustomId('menu:modal:coins')
    .setTitle('💰 Điều Chỉnh Xu')
    .addComponents(
      makeTargetInput(),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('amount').setLabel('Số xu (âm = trừ, dương = cộng)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('-999999 đến 999999'),
      ),
    ),

  exp: () => new ModalBuilder()
    .setCustomId('menu:modal:exp')
    .setTitle('⭐ Cộng EXP')
    .addComponents(
      makeTargetInput(),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('amount').setLabel('Số EXP cộng thêm').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('1–999999'),
      ),
    ),

  ban: () => new ModalBuilder()
    .setCustomId('menu:modal:ban')
    .setTitle('🔨 Ban Người Dùng')
    .addComponents(
      makeTargetInput(),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('reason').setLabel('Lý do (tùy chọn)').setStyle(TextInputStyle.Paragraph).setRequired(false).setPlaceholder('Không điền = "Không có lý do"'),
      ),
    ),

  unban: () => new ModalBuilder()
    .setCustomId('menu:modal:unban')
    .setTitle('✅ Bỏ Cấm Người Dùng')
    .addComponents(makeTargetInput()),

  setshop: () => new ModalBuilder()
    .setCustomId('menu:modal:setshop')
    .setTitle('🏬 Phân Quyền Shop')
    .addComponents(
      makeTargetInput(),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('grant').setLabel('Cấp quyền?').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('true = Cấp quyền  /  false = Thu hồi'),
      ),
    ),

  resetcd: () => new ModalBuilder()
    .setCustomId('menu:modal:resetcd')
    .setTitle('🔄 Reset Hồi Chiêu')
    .addComponents(
      makeTargetInput(),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('type').setLabel('Loại hồi chiêu').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('garden  /  farm  /  sneak  /  all'),
      ),
    ),

  reset: () => new ModalBuilder()
    .setCustomId('menu:modal:reset')
    .setTitle('⚠️ Xóa Dữ Liệu Người Dùng')
    .addComponents(
      makeTargetInput(),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('confirm').setLabel('Nhập "XÁC NHẬN" để tiến hành').setStyle(TextInputStyle.Short).setRequired(true),
      ),
    ),

  broadcast: () => new ModalBuilder()
    .setCustomId('menu:modal:broadcast')
    .setTitle('📢 Broadcast Thông Báo')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('title').setLabel('Tiêu đề').setStyle(TextInputStyle.Short).setRequired(true),
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('content').setLabel('Nội dung (dùng \\n để xuống dòng)').setStyle(TextInputStyle.Paragraph).setRequired(true),
      ),
    ),
};

// ─── Module Export ────────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('menu')
    .setDescription('📱 Mở Bảng Điều Khiển Tiệm Bánh Mộng Mơ'),

  async executeMessage(message) {
    const user = await User.findOneAndUpdate(
      { userId: message.author.id, guildId: message.guild.id },
      { $setOnInsert: { username: message.author.username } },
      { upsert: true, new: true },
    );
    const role = getRole(message.author.id, user);
    const msg = await message.reply(buildMenu(user, message.member || message.author, role, 'home'));
    refreshMenuTimeout(msg);
  },

  async execute(interaction) {
    const user = await User.findOneAndUpdate(
      { userId: interaction.user.id, guildId: interaction.guildId },
      { $setOnInsert: { username: interaction.user.username } },
      { upsert: true, new: true },
    );
    const role = getRole(interaction.user.id, user);
    const msg = await interaction.reply({ ...buildMenu(user, interaction.member || interaction.user, role, 'home'), fetchReply: true });
    refreshMenuTimeout(msg);
  },

  async handleComponent(interaction) {
    const parts  = interaction.customId.split(':');
    const action = parts[1];

    // ── Đóng Menu (Tắt tin nhắn) ──────────────────────────────────────────────
    if (action === 'close') {
      return interaction.message.delete().catch(() => {});
    }

    // ── Dropdown Nav (Danh sách thả xuống) ────────────────────────────────────
    if (action === 'nav') {
      const category = interaction.values[0];
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const role = getRole(interaction.user.id, user);
      return interaction.update(buildMenu(user, interaction.member || interaction.user, role, category));
    }

    // ── Quay về Home ──────────────────────────────────────────────────────────
    if (action === 'home') {
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const role = getRole(interaction.user.id, user);
      return interaction.update(buildMenu(user, interaction.member || interaction.user, role, 'home'));
    }

    // ── Nút "Quay Lại" từ các lệnh khác ───────────────────────────────────────
    if (action === 'section') {
      const section = parts[2];
      const user    = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const role    = getRole(interaction.user.id, user);

      // Định tuyến lại vì shop/trade đã gộp
      const map = { bakery: 'profile', harvest: 'harvest', bake: 'trade', trade: 'trade', orders: 'trade', social: 'social', shop: 'trade', dev: 'dev' };
      const cat = map[section] || 'home';

      if (section === 'pets') {
        interaction.customId = 'pet:open';
        return interaction.client.commands.get('pet').handleComponent(interaction);
      }

      return interaction.update(buildMenu(user, interaction.member || interaction.user, role, cat));
    }

    // ── Xã Hội: Chọn người chơi mục tiêu ─────────────────────────────────────
    if (action === 'target') {
      const targetId = interaction.values[0];
      if (targetId === interaction.user.id) {
        return interaction.reply({ embeds: [errorEmbed('Bạn không thể tương tác với chính mình!')], flags: MessageFlags.Ephemeral });
      }
      const targetUser = await interaction.client.users.fetch(targetId).catch(() => null);
      if (!targetUser) return interaction.reply({ embeds: [errorEmbed('Không tìm thấy người dùng!')], flags: MessageFlags.Ephemeral });

      const embed = bakeryEmbed(
        `🎯 Tương Tác: ${targetUser.displayName || targetUser.username}`,
        [
          `Bạn muốn làm gì với **${targetUser.displayName || targetUser.username}**?`,
          '',
          `⚔️ **Thách Đấu (Cược)** — Đấu Pet ăn tiền sòng phẳng`,
          `🏴‍☠️ **Úp Sọt (Cướp)** — Dẫn Pet qua đập phá nhà đối thủ`,
          `💸 **Chuyển Tiền** — Tặng xu cho họ`,
          `🎁 **Tặng Quà** — Gửi vật phẩm`,
        ].join('\n'),
        COLORS.warning,
      ).setThumbnail(targetUser.displayAvatarURL());

      const navMenu = new StringSelectMenuBuilder().setCustomId('menu:nav').setDisabled(true).addOptions([{ label: 'Đang tương tác...', value: 'locked' }]);

      return interaction.update({
        embeds: [embed],
        components: [
          row(navMenu),
          row(btn(`menu:battle_bet:${targetId}`, '⚔️ Thách Đấu (Cược)', 'Primary'), btn(`menu:battle_force:${targetId}`, '🏴‍☠️ Úp Sọt (Cướp)', 'Danger')),
          row(btn(`sneak:do:${targetId}`, '🐾 Trộm Vườn', 'Secondary'), btn(`chuyentien:open:${targetId}`, '💸 Chuyển Tiền', 'Success')),
          row(btn('menu:section:social', '◀ Quay Lại Xã Hội', 'Secondary'), btn('menu:close', '❌ Đóng', 'Danger')),
        ],
      });
    }

    // ── PvP: Thách Đấu (Mở Modal nhập xu) ────────────────────────────────────
    if (action === 'battle_bet') {
      const targetId = parts[2];
      const modal = new ModalBuilder()
        .setCustomId(`menu:modal:battle_bet:${targetId}`)
        .setTitle('⚔️ Cược Xu Đấu Pet');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('bet_amount').setLabel('Số xu muốn cược (Thắng ăn cả)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('1000')
        )
      );
      return interaction.showModal(modal);
    }

    // ── PvP: Úp Sọt (Chạy ngay) ──────────────────────────────────────────────
    if (action === 'battle_force') {
      await interaction.deferUpdate();
      const targetId = parts[2];
      const [attacker, victim] = await Promise.all([
        User.findOne({ userId: interaction.user.id, guildId: interaction.guildId }),
        User.findOne({ userId: targetId,            guildId: interaction.guildId }),
      ]);
      const backRow = row(btn('menu:home', '◀ Menu', 'Secondary'));

      if (!victim) return interaction.editReply({ embeds: [errorEmbed('Đối thủ chưa từng chơi game!')], components: [backRow] });

      const result = await petBattleEngine(interaction, attacker, victim, 'force');
      if (result.error) return interaction.editReply({ embeds: [errorEmbed(result.error)], components: [backRow] });

      const targetUser = await interaction.client.users.fetch(targetId).catch(() => ({ displayName: 'Unknown' }));

      const msg = [
        `⚔️ **${attacker.username}** xua **${result.aPet.name}** qua đập phá nhà **${targetUser.displayName}**!`,
        '',
        ...result.log.map((l, i) => `*Lượt ${i+1}:* ${l}`),
        '',
        `❤️ **${result.aPet.name}:** ${Math.floor(result.aHp)}/${result.aMaxHp} HP  |  ❤️ **${result.vPet.name}:** ${Math.floor(result.vHp)}/${result.vMaxHp} HP`,
        '',
        result.resultMsg,
      ].join('\n');

      return interaction.editReply({
        embeds: [bakeryEmbed('🏴‍☠️ Úp Sọt Kẻ Thù', msg, result.isWin ? COLORS.success : COLORS.error)],
        components: [backRow],
      });
    }

    // ── Dev Panel: Mở Modal ───────────────────────────────────────────────────
    if (action === 'dev') {
      if (!isDev(interaction.user.id)) {
        return interaction.reply({ embeds: [errorEmbed('🔒 Truy cập bị từ chối!')], flags: MessageFlags.Ephemeral });
      }
      const sub = parts[2];

      if (sub === 'stats') {
        await interaction.deferUpdate();
        const [totalPlayers, totalListings, richest, mostBaked, topExp, totalCoinsAgg] = await Promise.all([
          User.countDocuments({ guildId: interaction.guildId }),
          ShopListing.countDocuments({ guildId: interaction.guildId }),
          User.findOne({ guildId: interaction.guildId }).sort({ coins: -1 }).select('username coins').lean(),
          User.findOne({ guildId: interaction.guildId }).sort({ 'stats.totalBaked': -1 }).select('username stats').lean(),
          User.findOne({ guildId: interaction.guildId }).sort({ exp: -1 }).select('username exp').lean(),
          User.aggregate([{ $match: { guildId: interaction.guildId } }, { $group: { _id: null, total: { $sum: '$coins' } } }]),
        ]);
        const totalCoins = totalCoinsAgg[0]?.total || 0;
        return interaction.editReply({
          embeds: [bakeryEmbed(
            `📊 Thống Kê — ${interaction.guild.name}`,
            [
              `> *Tổng quan hệ thống Tiệm Bánh Mộng Mơ*`,
              '',
              `**👥 Người chơi:** ${totalPlayers}`,
              `**🏬 Listing đang bán:** ${totalListings}`,
              `**💰 Tổng xu lưu thông:** ${totalCoins.toLocaleString('vi-VN')} xu`,
              '',
              `**🏆 Kỷ lục**`,
              richest   ? `· 💰 Giàu nhất: **${richest.username}** — ${richest.coins.toLocaleString('vi-VN')} xu` : '',
              mostBaked ? `· 🧁 Nướng nhiều nhất: **${mostBaked.username}** — ${mostBaked.stats.totalBaked} bánh` : '',
              topExp    ? `· ⭐ Cấp cao nhất: **${topExp.username}** — Cấp ${calcLevel(topExp.exp)}` : '',
            ].filter(Boolean).join('\n'),
            COLORS.gold,
          )],
          components: [row(btn('menu:section:dev', '◀ Dev Panel', 'Secondary'))],
        });
      }

      if (DEV_MODALS[sub]) return interaction.showModal(DEV_MODALS[sub]());
    }
  },

  // ─── Modal Handlers (Dev Panel) ─────────────────────────────────────────────
  async handleModal(interaction) {
    if (!isDev(interaction.user.id)) {
      return interaction.reply({ embeds: [errorEmbed('🔒 Truy cập bị từ chối!')], flags: MessageFlags.Ephemeral });
    }

    const sub      = interaction.customId.split(':')[2]; // menu:modal:give → 'give'
    const backBtn  = row(btn('menu:section:dev', '◀ Dev Panel', 'Secondary'));

    // ── PvP: Thực thi Thách Đấu (Bet) ─────────────────────────────────────────
    if (interaction.customId.startsWith('menu:modal:battle_bet:')) {
      await interaction.deferUpdate();
      const targetId = interaction.customId.split(':')[3];
      const amount = parseInt(interaction.fields.getTextInputValue('bet_amount'));
      const backRow  = row(btn('menu:home', '◀ Menu', 'Secondary'));

      if (isNaN(amount) || amount <= 0) return interaction.editReply({ embeds: [errorEmbed('Số tiền cược không hợp lệ!')], components: [backRow] });

      const [attacker, victim] = await Promise.all([
        User.findOne({ userId: interaction.user.id, guildId: interaction.guildId }),
        User.findOne({ userId: targetId,            guildId: interaction.guildId }),
      ]);

      if (!victim) return interaction.editReply({ embeds: [errorEmbed('Đối thủ chưa từng chơi game!')], components: [backRow] });
      
      const targetUser = await interaction.client.users.fetch(targetId).catch(() => ({ displayName: 'Unknown' }));

      // Gọi Engine Đấu Pet
      const result = await petBattleEngine(interaction, attacker, victim, 'bet', amount);
      if (result.error) return interaction.editReply({ embeds: [errorEmbed(result.error)], components: [backRow] });

      // Render Log
      const msg = [
        `⚔️ **${attacker.username}** thách đấu cược **${amount.toLocaleString()} xu** với **${targetUser.displayName}**!`,
        '',
        ...result.log.map((l, i) => `*Lượt ${i+1}:* ${l}`),
        '',
        `❤️ **${result.aPet.name}:** ${Math.floor(result.aHp)}/${result.aMaxHp} HP  |  ❤️ **${result.vPet.name}:** ${Math.floor(result.vHp)}/${result.vMaxHp} HP`,
        '',
        result.resultMsg,
      ].join('\n');

      return interaction.editReply({
        embeds: [bakeryEmbed('⚔️ Sàn Đấu Linh Thú', msg, result.isWin ? COLORS.success : COLORS.error)],
        components: [backRow],
      });
    }

    // Giải mã target từ tất cả modal trừ broadcast
    let targetId = null;
    if (sub !== 'broadcast') {
      const rawTarget = interaction.fields.getTextInputValue('target');
      targetId = resolveUserId(rawTarget);
      if (!targetId) {
        return interaction.reply({
          embeds: [errorEmbed('Không nhận dạng được người dùng!\nVui lòng nhập: @mention, ID số, hoặc `discord.com/users/...`')],
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    // Helper log admin
    const logAdmin = async (action, targetId, details) => {
      await AdminLog.create({
        adminId: interaction.user.id,
        adminName: interaction.user.displayName || interaction.user.username,
        guildId: interaction.guildId,
        action,
        targetId,
        details
      }).catch(() => {});
    };

    // ── Tặng vật phẩm ─────────────────────────────────────────────────────────
    if (sub === 'give') {
      const itemKey = interaction.fields.getTextInputValue('item').trim().toLowerCase();
      const qty     = parseInt(interaction.fields.getTextInputValue('qty'), 10);
      if (!ALL_ITEM_KEYS.includes(itemKey)) {
        return interaction.reply({ embeds: [errorEmbed(`Item **${itemKey}** không tồn tại!`)], flags: MessageFlags.Ephemeral });
      }
      if (isNaN(qty) || qty < 1 || qty > 9999) {
        return interaction.reply({ embeds: [errorEmbed('Số lượng không hợp lệ (1–9999)!')], flags: MessageFlags.Ephemeral });
      }
      const user = await User.findOneAndUpdate(
        { userId: targetId, guildId: interaction.guildId },
        { $setOnInsert: { username: targetId } },
        { upsert: true, new: true },
      );
      user.inventory[itemKey] = (user.inventory[itemKey] || 0) + qty;
      user.markModified('inventory');
      await user.save();
      const info = getItemInfo(itemKey);
      await logAdmin('GIVE_ITEM', targetId, `Tặng ${qty} x ${itemKey}`);
      return interaction.reply({
        embeds: [successEmbed('✅ Đã Tặng Vật Phẩm', `👤 **<@${targetId}>** nhận được:\n${info ? `${info.emoji} ${info.name}` : itemKey} × **${qty}**`)],
        components: [backBtn],
        flags: MessageFlags.Ephemeral
      });
    }

    // ── Điều chỉnh xu ─────────────────────────────────────────────────────────
    if (sub === 'coins') {
      const amount = parseInt(interaction.fields.getTextInputValue('amount'), 10);
      if (isNaN(amount)) return interaction.reply({ embeds: [errorEmbed('Số xu không hợp lệ!')], flags: MessageFlags.Ephemeral });
      const user = await User.findOneAndUpdate(
        { userId: targetId, guildId: interaction.guildId },
        { $setOnInsert: { username: targetId } },
        { upsert: true, new: true },
      );
      const newCoins = Math.max(0, user.coins + amount);
      user.coins = newCoins;
      await user.save();
      await logAdmin('COINS', targetId, `Thay đổi ${amount} xu`);
      return interaction.reply({
        embeds: [successEmbed('✅ Đã Điều Chỉnh Xu',
          `👤 **<@${targetId}>**\n💰 ${amount >= 0 ? '+' : ''}${amount} xu → Tổng: **${newCoins.toLocaleString('vi-VN')}** xu`,
        )],
        components: [backBtn],
        flags: MessageFlags.Ephemeral
      });
    }

    // ── Cộng EXP ──────────────────────────────────────────────────────────────
    if (sub === 'exp') {
      const amount = parseInt(interaction.fields.getTextInputValue('amount'), 10);
      if (isNaN(amount) || amount < 1) return interaction.reply({ embeds: [errorEmbed('Số EXP không hợp lệ!')], flags: MessageFlags.Ephemeral });
      const user = await User.findOneAndUpdate(
        { userId: targetId, guildId: interaction.guildId },
        { $setOnInsert: { username: targetId } },
        { upsert: true, new: true },
      );
      user.exp += amount;
      await user.save();
      await logAdmin('EXP', targetId, `Cộng ${amount} EXP`);
      return interaction.reply({
        embeds: [successEmbed('✅ Đã Cộng EXP',
          `👤 **<@${targetId}>**\n⭐ +**${amount}** EXP → Cấp **${calcLevel(user.exp)}**`,
        )],
        components: [backBtn],
        flags: MessageFlags.Ephemeral
      });
    }

    // ── Ban ───────────────────────────────────────────────────────────────────
    if (sub === 'ban') {
      if (targetId === interaction.user.id) {
        return interaction.reply({ embeds: [errorEmbed('Không thể tự ban mình!')], flags: MessageFlags.Ephemeral });
      }
      const reason = interaction.fields.getTextInputValue('reason') || 'Không có lý do';
      await User.findOneAndUpdate(
        { userId: targetId, guildId: interaction.guildId },
        { $set: { banned: true, banReason: reason } },
        { upsert: true },
      );
      await logAdmin('BAN', targetId, `Lý do: ${reason}`);
      return interaction.reply({
        embeds: [bakeryEmbed('🔨 Đã Cấm Người Dùng',
          `👤 **<@${targetId}>** bị cấm.\n📝 Lý do: *${reason}*`,
          COLORS.error,
        )],
        components: [backBtn],
      });
    }

    // ── Unban ─────────────────────────────────────────────────────────────────
    if (sub === 'unban') {
      await User.findOneAndUpdate(
        { userId: targetId, guildId: interaction.guildId },
        { $unset: { banned: '', banReason: '' } },
        { upsert: true },
      );
      await logAdmin('UNBAN', targetId, `Bỏ cấm`);
      return interaction.reply({
        embeds: [successEmbed('✅ Đã Bỏ Cấm', `👤 **<@${targetId}>** có thể sử dụng bot trở lại.`)],
        components: [backBtn],
        flags: MessageFlags.Ephemeral
      });
    }

    // ── Phân quyền Shop ───────────────────────────────────────────────────────
    if (sub === 'setshop') {
      const grantStr = interaction.fields.getTextInputValue('grant').trim().toLowerCase();
      const grant    = ['true', 'có', '1', 'yes'].includes(grantStr);
      const user = await User.findOneAndUpdate(
        { userId: targetId, guildId: interaction.guildId },
        { $setOnInsert: { username: targetId } },
        { upsert: true, new: true },
      );
      user.isShopOwner = grant;
      await user.save();
      await logAdmin('SETSHOP', targetId, `Set Shop: ${grant}`);
      return interaction.reply({
        embeds: [successEmbed('🏬 Đã Phân Quyền',
          `👤 **<@${targetId}>**\nQuyền Chủ Shop: **${grant ? 'BẬT ✅' : 'TẮT ❌'}**`,
        )],
        components: [backBtn],
        flags: MessageFlags.Ephemeral
      });
    }

    // ── Reset hồi chiêu ───────────────────────────────────────────────────────
    if (sub === 'resetcd') {
      const type = interaction.fields.getTextInputValue('type').trim().toLowerCase();
      if (!['garden', 'farm', 'sneak', 'all'].includes(type)) {
        return interaction.reply({ embeds: [errorEmbed('Loại không hợp lệ! (garden / farm / sneak / all)')], flags: MessageFlags.Ephemeral });
      }
      const user = await User.findOneAndUpdate(
        { userId: targetId, guildId: interaction.guildId },
        { $setOnInsert: { username: targetId } },
        { upsert: true, new: true },
      );
      if (type === 'all' || type === 'garden') user.cooldowns.garden = null;
      if (type === 'all' || type === 'farm')   user.cooldowns.farm   = null;
      if (type === 'all' || type === 'sneak')  user.cooldowns.sneak  = null;
      await user.save();
      await logAdmin('RESET_CD', targetId, `Reset CD: ${type}`);
      return interaction.reply({
        embeds: [successEmbed('✅ Đã Reset Hồi Chiêu', `👤 **<@${targetId}>** — đã reset: **${type}**`)],
        components: [backBtn],
        flags: MessageFlags.Ephemeral
      });
    }

    // ── Xóa dữ liệu ──────────────────────────────────────────────────────────
    if (sub === 'reset') {
      const confirm = interaction.fields.getTextInputValue('confirm').trim().toUpperCase();
      if (confirm !== 'XÁC NHẬN') {
        return interaction.reply({ embeds: [errorEmbed('Phải nhập chính xác **"XÁC NHẬN"** để tiến hành!')], flags: MessageFlags.Ephemeral });
      }
      await Promise.all([
        User.deleteOne({ userId: targetId, guildId: interaction.guildId }),
        ShopListing.deleteMany({ sellerId: targetId, guildId: interaction.guildId }),
      ]);
      await logAdmin('RESET_DATA', targetId, `Xóa toàn bộ dữ liệu`);
      return interaction.reply({
        embeds: [successEmbed('⚠️ Đã Xóa Dữ Liệu', `👤 **<@${targetId}>** — Toàn bộ dữ liệu đã bị xóa.\n*(Kho đồ, xu, EXP, shop listings)*`)],
        components: [backBtn],
        flags: MessageFlags.Ephemeral
      });
    }

    // ── Broadcast ─────────────────────────────────────────────────────────────
    if (sub === 'broadcast') {
      const title   = interaction.fields.getTextInputValue('title');
      const content = interaction.fields.getTextInputValue('content').replace(/\\n/g, '\n');
      await interaction.channel.send({
        embeds: [bakeryEmbed(title, content, COLORS.primary)
          .setAuthor({ name: `📢 Thông báo từ ${interaction.user.displayName}`, iconURL: interaction.user.displayAvatarURL() })],
      });
      return interaction.reply({
        embeds: [successEmbed('✅ Đã Broadcast', 'Thông báo đã được gửi vào kênh hiện tại.')],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
