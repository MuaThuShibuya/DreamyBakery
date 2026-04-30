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
    // Các danh mục đã được tách biệt rõ ràng (Tuyệt đối không dùng chung)
    { label: '🏬 Tiệm Bánh', description: 'Nướng bánh và quản lý đơn hàng', value: 'bakery' },
    { label: '🛒 Thương Mại', description: 'Chợ NPC và Shop người chơi', value: 'trade' },
    { label: '💳 Ngân Hàng', description: 'Chuyển khoản và vay nợ', value: 'bank' },
    { label: '🐾 Trại Thú Cưng', description: 'Quản lý thú cưng, trang bị và kỹ năng', value: 'pets' },
    { label: '🏰 Tháp Aincrad', description: 'Khiêu chiến hộ vệ tháp để nhận thưởng', value: 'tower' },
    { label: '🎮 Xã Hội & Giải Trí', description: 'Tương tác, PvP, bảng xếp hạng', value: 'social' },
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
        `Xin chào, **${member.displayName || member.username}**! *(${roleBadge})*`,
        `Chào mừng bạn trở lại với Tiệm Bánh Mộng Mơ 🌸`,
        ``,
        `╭───────── **TỔNG QUAN** ─────────╮`,
        ` 💰 **Tài sản:** \`${user.coins.toLocaleString('vi-VN')}\` xu`,
        ` ⭐ **Cấp ${lvl}:** \`[${progressBar(pct, 12)}]\` ${pct}%`,
        ` ❤️ **Thể lực:** ${Math.floor(user.hp)} / 100 *(+1 HP/3p)*`,
        `╰────────────────────────────────╯`,
        ``,
        `🔽 *Sử dụng Menu thả xuống bên dưới để thao tác*`,
      ].join('\n'),
      role === ROLE.DEV ? COLORS.gold : role === ROLE.SHOP ? COLORS.purple : COLORS.primary
    );
    if (member.displayAvatarURL) embed.setThumbnail(member.displayAvatarURL());
    
    // Hàng nút thao tác nhanh ngoài Trang chủ
    btnRows.push(row(
      btn('daily:claim', '🎁 Điểm Danh', 'Primary'),
      btn('inventory:open', '📦 Kho Đồ', 'Primary'),
    ));
  }
  else if (category === 'profile') {
    const level = calcLevel(user.exp);
    const { progress, needed, pct } = levelProgress(user.exp, level);
    const title = getLevelTitle(level);

    let descLines = [
      `**Danh hiệu:** ${title} ✨`,
      `**Cấp độ:** ${level} — Tiến trình: ${pct}%`,
      `\`[${progressBar(pct, 20)}]\``,
      `*(${progress} / ${needed} EXP)*`,
      '',
    ];

    if (role === ROLE.SHOP || role === ROLE.DEV) {
      descLines.push(
        `**🏭 Kinh Doanh & Sản Xuất**`,
        `> 🧁 Đã nướng: **${user.stats.totalBaked}** bánh`,
        `> 💸 Đã bán: **${user.stats.totalSold}** bánh`,
        `> 📋 Đơn NPC: **${user.stats.totalOrders}** đơn`,
        ''
      );
    }
    descLines.push(
      `**🏡 Nâng Cấp Thiết Bị**`,
      `> 🔥 Lò nướng: Cấp **${user.upgrades.oven || 0}/5**`,
      `> 🌸 Trang trí: Cấp **${user.upgrades.decor || 0}/5**`,
      `> 🌿 Khu Vườn: Cấp **${user.upgrades.garden || 0}/5**`,
      `> 🐄 Trang Trại: Cấp **${user.upgrades.farm || 0}/5**`,
      '',
      `**🎮 Hoạt Động Xã Hội**`,
      `> 🎁 Tặng quà: **${user.stats.totalGifts}** lần`,
      `> 🐾 Trộm vườn: **${user.stats.totalSneaks}** lần`,
      `> ⚔️ Đấu thắng: **${user.stats.pvpWins || 0}** trận`
    );

    embed = bakeryEmbed(`👤 Hồ Sơ Của ${member.displayName || member.username}`, descLines.join('\n'), COLORS.primary);
    if (member.displayAvatarURL) embed.setThumbnail(member.displayAvatarURL());
    
    btnRows.push(row(
      btn('inventory:open', '📦 Mở Kho Đồ', 'Primary'),
      btn('upgrade:open', '⬆️ Nâng Cấp', 'Primary'),
      btn('eat:open', '🍰 Ăn Bánh', 'Secondary')
    ));
  }
  else if (category === 'harvest') {
    embed = bakeryEmbed('🌿 Khu Sinh Thái', `Tiến hành trồng trọt và chăn nuôi để thu thập nguyên liệu.\n\n💡 *Mẹo: Nâng cấp Vườn và Trại để tăng sản lượng nhận được!*`, COLORS.success);
    btnRows.push(row(btn('garden:open', '🌿 Ra Vườn (5p)', 'Primary'), btn('farm:open', '🏡 Ra Trại (10p)', 'Primary')));
  }
  else if (category === 'bakery') {
    // Phân khu Tiệm Bánh
    if (role === ROLE.USER) {
      embed = bakeryEmbed('🏬 Tiệm Bánh', `Khu vực nướng bánh và giao đơn.\n\n🔒 **Lưu ý:** Bạn cần Giấy Phép Kinh Doanh để mở khóa Lò nướng và Tiệm Bánh.`, COLORS.gold);
    } else {
      embed = bakeryEmbed('🏬 Tiệm Bánh', `Nơi tạo ra những chiếc bánh hảo hạng và phục vụ khách hàng!`, COLORS.gold);
      btnRows.push(row(btn('bake:open', '🧁 Nướng Bánh', 'Primary'), btn('oven:open', '🔥 Lò Nướng', 'Primary'), btn('cookbook:open', '📖 Sổ Tay', 'Secondary')));
      btnRows.push(row(btn('order:open', '📋 Giao Đơn NPC', 'Primary')));
    }
  }
  else if (category === 'trade') {
    // Phân khu Thương Mại
    embed = bakeryEmbed('🛒 Thương Mại', `Khu vực giao thương sầm uất của thị trấn.`, COLORS.gold);
    if (role === ROLE.USER) {
      btnRows.push(row(btn('market:open', '🏪 Chợ NPC', 'Primary'), btn('shop:open', '🏬 Xem Shop', 'Primary')));
    } else {
      btnRows.push(row(btn('market:open', '🏪 Chợ Đen', 'Primary'), btn('shop:open', '🏬 Shop Của Bạn', 'Secondary')));
    }
    btnRows.push(row(btn('pet:gear_shop', '🛡️ Shop Trang Bị', 'Success'), btn('pet:skill_shop', '📜 Shop Kỹ Năng', 'Success')));
  }
  else if (category === 'bank') {
    embed = bakeryEmbed('💳 Ngân Hàng', `Quản lý tài chính, chuyển khoản và vay nợ.`, COLORS.success);
    btnRows.push(row(btn('menu:vay:open', '💳 Tự Động Vay / Trả', 'Primary')));
  }
  else if (category === 'social') {
    embed = bakeryEmbed('🎮 Xã Hội & Giải Trí', `Tương tác với bạn bè, Thách đấu và Cạnh tranh thứ hạng.\n\n🔽 *Chọn một người chơi bên dưới để thao tác:*`, COLORS.warning);
    btnRows.push(row(userSelectMenu('menu:target', '🎯 Chọn người chơi để tương tác...')));
    btnRows.push(row(btn('top:open', '🏆 Bảng Xếp Hạng', 'Primary')));
  }
  else if (category === 'dev') {
    embed = bakeryEmbed('🔧 Bảng Điều Khiển Dev', `Khu vực quản trị tối cao của hệ thống.`, COLORS.gold);
    // Gộp nút Dev lại thành 3 hàng để tránh lỗi Discord "Must be 5 or fewer"
    btnRows.push(row(btn('menu:dev:give', '🎁 Tặng Đồ', 'Primary'), btn('menu:dev:coins', '💰 Chỉnh Xu', 'Primary'), btn('menu:dev:exp', '⭐ Cộng EXP', 'Primary'), btn('menu:dev:setshop', '🏬 Cấp Shop', 'Primary')));
    btnRows.push(row(btn('menu:dev:ban', '🔨 Ban', 'Danger'), btn('menu:dev:unban', '✅ Bỏ Cấm', 'Success'), btn('menu:dev:stats', '📊 Thống Kê', 'Secondary'), btn('menu:dev:broadcast', '📢 Broadcast', 'Secondary')));
    btnRows.push(row(btn('menu:dev:resetcd', '🔄 Reset CD', 'Secondary'), btn('menu:dev:reset', '⚠️ Xóa Dữ Liệu', 'Danger')));
  }
  else {
    embed = bakeryEmbed('❌ Lỗi Hiển Thị', 'Danh mục này không còn tồn tại do hệ thống vừa được nâng cấp. Vui lòng chọn danh mục khác!', COLORS.error);
  }

  // Luôn có nút Trang Chủ và Đóng
  const footerRow = category === 'home' 
    ? row(btn('menu:close', '❌ Đóng Bảng Điều Khiển', 'Danger'))
    : row(btn('menu:home', '🏠 Về Trang Chủ', 'Secondary'), btn('menu:close', '❌ Đóng', 'Danger'));

  btnRows.push(footerRow);
  return { embeds: [embed], components: [row(navMenu), ...btnRows] };
}

// ─── Dev Modal Builders ───────────────────────────────────────────────────────

function makeTargetInput() {
  return new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('target')
      .setLabel('Người dùng (Mention / ID / Link)')
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
        new TextInputBuilder().setCustomId('item').setLabel('Tên vật phẩm (VD: wheat, crystals)').setStyle(TextInputStyle.Short).setRequired(true),
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
        new TextInputBuilder().setCustomId('type').setLabel('Loại xóa (all / coins / inv / exp)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('all'),
      ),
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

    // DEBUG MENU
    console.log(`[📂 DEBUG MENU] Handle Action: '${action}' | Parts: [${parts.join(', ')}] | Values: [${interaction.values?.join(', ') || 'N/A'}]`);

    // ── Đóng Menu (Tắt tin nhắn) ──────────────────────────────────────────────
    if (action === 'close') {
      return interaction.message.delete().catch(() => {});
    }

    // ── Dropdown Nav & Nút Quay Lại (Section) ─────────────────────────────────
    if (action === 'nav' || action === 'section') {
      const category = action === 'nav' ? interaction.values[0] : parts[2];
      console.log(`[📂 DEBUG MENU] Đang điều hướng tới Category: '${category}'`);
      
      if (category === 'locked') return interaction.deferUpdate().catch(() => {});
      
      // Chuyển hướng sang module Pet / Tower
      if (category === 'pets') {
        interaction.customId = 'pet:open';
        return interaction.client.commands.get('pet').handleComponent(interaction);
      }
      if (category === 'tower') {
        interaction.customId = 'pet:tower';
        return interaction.client.commands.get('pet').handleComponent(interaction);
      }

      // Gọi Menu Nội Bộ
      const user = await User.findOneAndUpdate({ userId: interaction.user.id, guildId: interaction.guildId }, { $setOnInsert: { username: interaction.user.username } }, { upsert: true, new: true });
      const role = getRole(interaction.user.id, user);

      try {
        return await interaction.update(buildMenu(user, interaction.member || interaction.user, role, category));
      } catch (e) {
        if (e.code === 40060 || e.code === 10062 || e.code === 'InteractionAlreadyReplied') return;
        throw e;
      }
    }

    // ── Quay về Home ──────────────────────────────────────────────────────────
    if (action === 'home') {
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const role = getRole(interaction.user.id, user);
      try {
        return await interaction.update(buildMenu(user, interaction.member || interaction.user, role, 'home'));
      } catch (e) {
        if (e.code === 40060 || e.code === 10062 || e.code === 'InteractionAlreadyReplied') return;
        throw e;
      }
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
        row(btn(`sneak:do:${targetId}`, '🐾 Trộm Vườn', 'Secondary'), btn(`menu:gift:open:${targetId}`, '🎁 Tặng Đồ', 'Success')),
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

    // ── Ngân Hàng Tự Động ──────────────────────────────────────────────────
    if (action === 'vay') {
        const sub = parts[2];
        if (sub === 'open') {
            const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
            const embed = bakeryEmbed('💳 Ngân Hàng Mộng Mơ', `💰 Số dư hiện tại: **${user.coins.toLocaleString('vi-VN')} xu**\n📉 Dư nợ: **${(user.debt || 0).toLocaleString('vi-VN')} xu**\n\nNgân hàng hỗ trợ tự động **Vay 50,000 xu** (lãi suất 10%).\nKhi thanh toán nợ, nếu không đủ số dư, tài khoản của bạn sẽ bị **âm tiền**!`, COLORS.success);
            return interaction.update({
                embeds: [embed],
                components: [
                    row(btn('menu:vay:loan', '💵 Vay 50,000 xu', 'Primary'), btn('menu:vay:repay', '💸 Trả toàn bộ nợ', 'Danger')),
                    row(btn('menu:section:bank', '◀ Quay Lại', 'Secondary'))
                ]
            });
        }
        if (sub === 'loan') {
            const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
            user.coins += 50000;
            user.debt = (user.debt || 0) + 55000;
            await user.save();
            return interaction.update({ embeds: [successEmbed('Thành công', 'Đã giải ngân 50,000 xu! Dư nợ tăng thêm 55,000 xu (gồm 10% lãi).')], components: [row(btn('menu:vay:open', '◀ Quay Lại Ngân Hàng', 'Secondary'))] });
        }
        if (sub === 'repay') {
            const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
            if (!user.debt || user.debt <= 0) return interaction.reply({ embeds: [errorEmbed('Bạn không có dư nợ!')], flags: MessageFlags.Ephemeral });
            user.coins -= user.debt;
            user.debt = 0;
            await user.save();
            return interaction.update({ embeds: [successEmbed('Thành công', `Đã thanh toán toàn bộ dư nợ!\nSố dư hiện tại: **${user.coins.toLocaleString('vi-VN')} xu**.`)], components: [row(btn('menu:vay:open', '◀ Quay Lại Ngân Hàng', 'Secondary'))] });
        }
    }

    // ── Tặng Đồ (Gift) ──────────────────────────────────────────────────────
    if (action === 'gift') {
        const sub = parts[2];
        const targetId = parts[3];
        if (sub === 'open') {
            return interaction.update({
                embeds: [bakeryEmbed('🎁 Chọn Loại Quà', 'Bạn muốn tặng gì cho người chơi này?', COLORS.primary)],
                components: [
                    row(btn(`menu:gift:crystals:${targetId}`, '💎 Tinh Thể', 'Primary'), btn(`menu:gift:skills:${targetId}`, '📜 Kỹ Năng', 'Primary'), btn(`menu:gift:gears:${targetId}`, '🛡️ Trang Bị', 'Primary')),
                    row(btn('menu:close', '❌ Đóng', 'Danger'))
                ]
            });
        }
        if (sub === 'crystals') {
            const modal = new ModalBuilder().setCustomId(`menu:modal:gift_crystals:${targetId}`).setTitle('🎁 Tặng Tinh Thể').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel('Số lượng Tinh Thể').setStyle(TextInputStyle.Short).setRequired(true)));
            return interaction.showModal(modal);
        }
        if (sub === 'skills' || sub === 'gears') {
            const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
            const options = [];
            const collection = sub === 'skills' ? user.skillBooks : user.gears;
            const ref = sub === 'skills' ? require('../../utils/constants').SKILL_BOOKS : require('../../utils/constants').GEARS;
            if (collection) for (const [k, v] of collection.entries()) if (v > 0 && ref[k]) options.push({ label: `${ref[k].emoji} ${ref[k].name} (Sẵn: ${v})`, value: k });
            if (!options.length) return interaction.reply({ embeds: [errorEmbed('Bạn không có món đồ nào trong kho này!')], flags: MessageFlags.Ephemeral });
            return interaction.update({ embeds: [bakeryEmbed('🎁 Chọn Món Quà', 'Chọn món đồ muốn tặng:', COLORS.primary)], components: [row(selectMenu(`menu:gift_select:${sub}:${targetId}`, 'Chọn món đồ...', options.slice(0, 25))), row(btn(`menu:gift:open:${targetId}`, '◀ Quay Lại', 'Secondary'))] });
        }
    }
    
    if (action === 'gift_select') {
        const sub = parts[2], targetId = parts[3], itemId = interaction.values[0];
        const modal = new ModalBuilder().setCustomId(`menu:modal:gift_item:${sub}:${targetId}:${itemId}`).setTitle('🎁 Nhập Số Lượng').addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amount').setLabel('Số lượng muốn tặng').setStyle(TextInputStyle.Short).setRequired(true)));
        return interaction.showModal(modal);
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

    // ── Tặng Quà (Gift) Modal ────────────────────────────────────────────────
    if (interaction.customId.startsWith('menu:modal:gift_')) {
        const parts = interaction.customId.split(':');
        const type = parts[2];
        const amount = parseInt(interaction.fields.getTextInputValue('amount'));
        
        if (isNaN(amount) || amount <= 0) return interaction.reply({ embeds: [errorEmbed('Số lượng không hợp lệ!')], flags: MessageFlags.Ephemeral });
        const sender = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
        
        if (type === 'gift_crystals') {
            const targetId = parts[3];
            if ((sender.crystals || 0) < amount) return interaction.reply({ embeds: [errorEmbed('Không đủ Tinh Thể!')], flags: MessageFlags.Ephemeral });
            const receiver = await User.findOneAndUpdate({ userId: targetId, guildId: interaction.guildId }, { $setOnInsert: { username: targetId } }, { upsert: true, new: true });
            sender.crystals -= amount;
            receiver.crystals = (receiver.crystals || 0) + amount;
            await Promise.all([sender.save(), receiver.save()]);
            return interaction.reply({ embeds: [successEmbed('🎁 Tặng Quà Thành Công!', `Đã tặng **${amount} 💎 Tinh Thể** cho <@${targetId}>.`)], flags: MessageFlags.Ephemeral });
        }
        
        if (type === 'gift_item') {
            const sub = parts[3], targetId = parts[4], itemId = parts[5];
            const collection = sub === 'skills' ? sender.skillBooks : sender.gears;
            const ref = sub === 'skills' ? require('../../utils/constants').SKILL_BOOKS : require('../../utils/constants').GEARS;
            if (!collection || (collection.get(itemId) || 0) < amount) return interaction.reply({ embeds: [errorEmbed('Không đủ vật phẩm trong kho!')], flags: MessageFlags.Ephemeral });
            
            const receiver = await User.findOneAndUpdate({ userId: targetId, guildId: interaction.guildId }, { $setOnInsert: { username: targetId } }, { upsert: true, new: true });
            collection.set(itemId, collection.get(itemId) - amount);
            sender.markModified(sub === 'skills' ? 'skillBooks' : 'gears');
            
            const rCollectionName = sub === 'skills' ? 'skillBooks' : 'gears';
            if (!receiver[rCollectionName]) receiver[rCollectionName] = new Map();
            receiver[rCollectionName].set(itemId, (receiver[rCollectionName].get(itemId) || 0) + amount);
            receiver.markModified(rCollectionName);
            await Promise.all([sender.save(), receiver.save()]);
            return interaction.reply({ embeds: [successEmbed('🎁 Tặng Quà Thành Công!', `Đã tặng **${amount}x ${ref[itemId].emoji} ${ref[itemId].name}** cho <@${targetId}>.`)], flags: MessageFlags.Ephemeral });
        }
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
      if (!ALL_ITEM_KEYS.includes(itemKey) && itemKey !== 'crystals') {
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
      if (itemKey === 'crystals') {
        user.crystals = (user.crystals || 0) + qty;
      } else {
        user.inventory[itemKey] = (user.inventory[itemKey] || 0) + qty;
        user.markModified('inventory');
      }
      await user.save();
      const info = getItemInfo(itemKey);
      await logAdmin('GIVE_ITEM', targetId, `Tặng ${qty} x ${itemKey}`);
      return interaction.reply({
        embeds: [successEmbed('✅ Đã Tặng Vật Phẩm', `👤 **<@${targetId}>** nhận được:\n${itemKey === 'crystals' ? '💎 Tinh Thể' : (info ? `${info.emoji} ${info.name}` : itemKey)} × **${qty}**`)],
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
      const type = interaction.fields.getTextInputValue('type').trim().toLowerCase();
      const confirm = interaction.fields.getTextInputValue('confirm').trim().toUpperCase();
      if (confirm !== 'XÁC NHẬN') {
        return interaction.reply({ embeds: [errorEmbed('Phải nhập chính xác **"XÁC NHẬN"** để tiến hành!')], flags: MessageFlags.Ephemeral });
      }
      if (!['all', 'coins', 'inv', 'exp'].includes(type)) {
        return interaction.reply({ embeds: [errorEmbed('Loại xóa không hợp lệ! Vui lòng nhập: all / coins / inv / exp')], flags: MessageFlags.Ephemeral });
      }
      
      if (type === 'all') {
        await Promise.all([
          User.deleteOne({ userId: targetId, guildId: interaction.guildId }),
          ShopListing.deleteMany({ sellerId: targetId, guildId: interaction.guildId }),
        ]);
        await logAdmin('RESET_DATA', targetId, `Xóa toàn bộ dữ liệu`);
        return interaction.reply({ embeds: [successEmbed('⚠️ Đã Xóa Dữ Liệu', `👤 **<@${targetId}>** — Toàn bộ dữ liệu đã bị xóa.\n*(Kho đồ, xu, EXP, shop listings)*`)], components: [backBtn], flags: MessageFlags.Ephemeral });
      } else {
        const user = await User.findOne({ userId: targetId, guildId: interaction.guildId });
        if (!user) return interaction.reply({ embeds: [errorEmbed('Không tìm thấy người chơi này!')], flags: MessageFlags.Ephemeral });
        
        if (type === 'coins') user.coins = 0;
        if (type === 'inv') user.inventory = {};
        if (type === 'exp') user.exp = 0;
        
        user.markModified('inventory');
        await user.save();
        await logAdmin('RESET_DATA', targetId, `Xóa dữ liệu: ${type}`);
        return interaction.reply({ embeds: [successEmbed('⚠️ Đã Xóa Dữ Liệu', `👤 **<@${targetId}>** — Đã xóa dữ liệu: **${type.toUpperCase()}**.`)], components: [backBtn], flags: MessageFlags.Ephemeral });
      }
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
