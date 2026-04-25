'use strict';
/**
 * @file admin.js
 * @description Lệnh /admin — Các lệnh quản trị dành riêng cho Admin server.
 *
 * BẢO MẬT DOANH NGHIỆP: 
 * Bỏ qua quyền Administrator của Discord. 
 * Lệnh này CHỈ hoạt động nếu người gọi lệnh có ID trùng với DEV_ID trong file .env.
 *
 * Các subcommand:
 *  give        — Tặng vật phẩm hoặc bánh cho người chơi
 *  setshop     — (Mới) Cấp quyền "Chủ Shop" cho người dùng
 *  setchannel  — Cấu hình kênh cho phép bot hoạt động
 *  coins       — Cộng / trừ xu của người chơi
 *  exp         — Cộng EXP cho người chơi
 *  resetcd     — Reset hồi chiêu (garden / farm / sneak / tất cả)
 *  reset       — Xóa toàn bộ dữ liệu của người chơi
 *  stats       — Xem thống kê tổng hợp server
 *  ban         — Cấm người chơi sử dụng bot
 *  unban       — Bỏ cấm người chơi
 *  broadcast   — Gửi thông báo dạng embed vào channel hiện tại
 */

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const User       = require('../../models/User');
const ShopListing = require('../../models/ShopListing');
const GuildConfig = require('../../models/Guild');
const AdminLog    = require('../../models/AdminLog');
const { bakeryEmbed, errorEmbed, successEmbed, btn, row } = require('../../utils/embeds');
const { ALL_ITEM_KEYS, INGREDIENTS, BAKED_GOODS, COLORS } = require('../../utils/constants');
const { getItemInfo, calcLevel } = require('../../utils/gameUtils');

// ─── Danh sách user bị ban (lưu trong DB dưới dạng field) ────────────────────
// Ban được lưu vào user.banned = true trong MongoDB
// Việc check ban nên được thêm vào interaction handler trung tâm (index.js)
// nếu muốn áp dụng toàn bộ lệnh. Hiện tại ban chỉ dừng ở cờ trong DB.

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Upsert người dùng — dùng cho give / coins / exp khi target chưa chơi.
 * @param {string} userId
 * @param {string} guildId
 * @param {string} username
 */
async function getOrCreate(userId, guildId, username) {
  return User.findOneAndUpdate(
    { userId, guildId },
    { $setOnInsert: { username } },
    { upsert: true, new: true },
  );
}

/** Kiểm tra DEV ID */
function isDev(userId) {
  return userId === process.env.DEV_ID;
}

async function logAdminAction(adminId, adminName, guildId, action, targetId, details) {
  await AdminLog.create({
    adminId,
    adminName,
    guildId,
    action,
    targetId,
    details
  }).catch(() => {});
}

// ─── Module export ───────────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('🔧 Các lệnh hệ thống (Chỉ dành cho Nhà Phát Triển / Owner)')

    // ── Subcommand: give ────────────────────────────────────────────────────
    .addSubcommand(sc => sc
      .setName('give')
      .setDescription('Tặng vật phẩm cho người chơi')
      .addUserOption(o => o.setName('nguoi_choi').setDescription('Người nhận').setRequired(true))
      .addStringOption(o => o
        .setName('vat_pham')
        .setDescription('Tên item (VD: wheat, strawberry_cupcake, shiny_cheesecake)')
        .setRequired(true))
      .addIntegerOption(o => o
        .setName('so_luong')
        .setDescription('Số lượng muốn cho')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(9999)))

    // ── Subcommand: setshop ─────────────────────────────────────────────────
    .addSubcommand(sc => sc
      .setName('setshop')
      .setDescription('Cấp hoặc tước quyền Chủ Shop của người chơi')
      .addUserOption(o => o.setName('nguoi_choi').setDescription('Người chơi').setRequired(true))
      .addBooleanOption(o => o
        .setName('quyen_han')
        .setDescription('True = Cấp quyền, False = Tước quyền')
        .setRequired(true)))

    // ── Subcommand: setchannel ──────────────────────────────────────────────
    .addSubcommand(sc => sc
      .setName('setchannel')
      .setDescription('Thêm/Xóa kênh được phép sử dụng bot (để trống = hoạt động mọi kênh)')
      .addStringOption(o => o
        .setName('hanh_dong')
        .setDescription('Thêm hoặc Xóa')
        .setRequired(true)
        .addChoices({ name: 'Thêm kênh', value: 'add' }, { name: 'Xóa kênh', value: 'remove' }))
      .addChannelOption(o => o.setName('kenh').setDescription('Kênh áp dụng').setRequired(true)))

    // ── Subcommand: coins ───────────────────────────────────────────────────
    .addSubcommand(sc => sc
      .setName('coins')
      .setDescription('Cộng / trừ xu của người chơi')
      .addUserOption(o => o.setName('nguoi_choi').setDescription('Người chơi').setRequired(true))
      .addIntegerOption(o => o
        .setName('so_luong')
        .setDescription('Số xu (âm = trừ, dương = cộng)')
        .setRequired(true)
        .setMinValue(-999999)
        .setMaxValue(999999)))

    // ── Subcommand: exp ─────────────────────────────────────────────────────
    .addSubcommand(sc => sc
      .setName('exp')
      .setDescription('Cộng EXP cho người chơi')
      .addUserOption(o => o.setName('nguoi_choi').setDescription('Người chơi').setRequired(true))
      .addIntegerOption(o => o
        .setName('so_luong')
        .setDescription('Số EXP cộng thêm')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(999999)))

    // ── Subcommand: resetcd ─────────────────────────────────────────────────
    .addSubcommand(sc => sc
      .setName('resetcd')
      .setDescription('Reset hồi chiêu của người chơi')
      .addUserOption(o => o.setName('nguoi_choi').setDescription('Người chơi').setRequired(true))
      .addStringOption(o => o
        .setName('loai')
        .setDescription('Loại hồi chiêu cần reset')
        .setRequired(true)
        .addChoices(
          { name: '🌿 Khu Vườn',   value: 'garden' },
          { name: '🏡 Trang Trại', value: 'farm'   },
          { name: '🐾 Trộm',       value: 'sneak'  },
          { name: '🔄 Tất Cả',     value: 'all'    },
        )))

    // ── Subcommand: reset ───────────────────────────────────────────────────
    .addSubcommand(sc => sc
      .setName('reset')
      .setDescription('⚠️ Xóa toàn bộ dữ liệu game của người chơi')
      .addUserOption(o => o.setName('nguoi_choi').setDescription('Người chơi').setRequired(true))
      .addStringOption(o => o
        .setName('loai')
        .setDescription('Loại xóa (all / coins / inv / exp)')
        .setRequired(true)
        .addChoices(
          { name: 'Tất cả (All)', value: 'all' },
          { name: 'Tiền (Coins)', value: 'coins' },
          { name: 'Kho đồ (Inventory)', value: 'inv' },
          { name: 'Kinh nghiệm (EXP)', value: 'exp' }
        ))
      .addBooleanOption(o => o
        .setName('xac_nhan')
        .setDescription('Nhập true để xác nhận (thao tác KHÔNG THỂ HOÀN TÁC)')
        .setRequired(true)))

    // ── Subcommand: stats ───────────────────────────────────────────────────
    .addSubcommand(sc => sc
      .setName('stats')
      .setDescription('Xem thống kê tổng hợp của server'))

    // ── Subcommand: ban ─────────────────────────────────────────────────────
    .addSubcommand(sc => sc
      .setName('ban')
      .setDescription('Cấm người chơi sử dụng bot')
      .addUserOption(o => o.setName('nguoi_choi').setDescription('Người bị cấm').setRequired(true))
      .addStringOption(o => o
        .setName('ly_do')
        .setDescription('Lý do cấm')
        .setRequired(false)))

    // ── Subcommand: unban ───────────────────────────────────────────────────
    .addSubcommand(sc => sc
      .setName('unban')
      .setDescription('Bỏ cấm người chơi')
      .addUserOption(o => o.setName('nguoi_choi').setDescription('Người được bỏ cấm').setRequired(true)))

    // ── Subcommand: broadcast ───────────────────────────────────────────────
    .addSubcommand(sc => sc
      .setName('broadcast')
      .setDescription('Gửi thông báo embed vào channel hiện tại')
      .addStringOption(o => o.setName('tieu_de').setDescription('Tiêu đề thông báo').setRequired(true))
      .addStringOption(o => o.setName('noi_dung').setDescription('Nội dung thông báo').setRequired(true))
      .addStringOption(o => o
        .setName('mau_sac')
        .setDescription('Màu embed')
        .setRequired(false)
        .addChoices(
          { name: '🌸 Hồng (mặc định)', value: 'primary' },
          { name: '✅ Xanh (thông báo tốt)', value: 'success' },
          { name: '⚠️ Vàng (cảnh báo)', value: 'warning' },
          { name: '❌ Đỏ (quan trọng)',  value: 'error'   },
          { name: '💛 Vàng Kim',         value: 'gold'    },
        )))

    // ── Subcommand: logs ────────────────────────────────────────────────────
    .addSubcommand(sc => sc
      .setName('logs')
      .setDescription('Xem lịch sử thao tác của Admin')
      .addUserOption(o => o.setName('nguoi_choi').setDescription('Lọc theo Admin').setRequired(false))),

  /** Thực thi lệnh !admin */
  async executeMessage(message, args) {
    if (!isDev(message.author.id)) {
      return message.reply({ embeds: [errorEmbed('🔒 Lệnh này được mã hóa nội bộ. Chỉ Nhà Phát Triển (Dev) mới có quyền truy cập!')] });
    }

    const sub = args[0]?.toLowerCase();
    if (!sub) {
      return message.reply({ embeds: [errorEmbed('Vui lòng nhập lệnh con!\nVí dụ: `.admin give @user wheat 5`, `.admin coins @user 100`, `.admin stats`')] });
    }

    // Lấy tag user đầu tiên
    const target = message.mentions.users.first();

    if (sub === 'give') {
      if (!target || args.length < 4) return message.reply({ embeds: [errorEmbed('Cú pháp: `.admin give @user [item] [qty]`')] });
      const itemKey = args[2].toLowerCase();
      const qty = parseInt(args[3]);
      if (isNaN(qty) || qty <= 0) return message.reply({ embeds: [errorEmbed('Số lượng không hợp lệ!')] });
      if (!ALL_ITEM_KEYS.includes(itemKey)) return message.reply({ embeds: [errorEmbed(`Item **${itemKey}** không tồn tại!`)] });

      const user = await getOrCreate(target.id, message.guild.id, target.username);
      user.inventory[itemKey] = (user.inventory[itemKey] || 0) + qty;
      user.markModified('inventory');
      await user.save();
      await logAdminAction(message.author.id, message.author.displayName, message.guild.id, 'GIVE', target.id, `Tặng ${qty} x ${itemKey}`);

      const info  = getItemInfo(itemKey);
      const label = info ? `${info.emoji} ${info.name}` : itemKey;
      return message.reply({ embeds: [successEmbed('✅ Đã Tặng Vật Phẩm', `👤 **${target.displayName}** nhận được:\n${label} × **${qty}**\n💳 Kho hiện tại: **${user.inventory[itemKey]}**`)] });
    }

    if (sub === 'setshop') {
      if (!target || args.length < 3) return message.reply({ embeds: [errorEmbed('Cú pháp: `.admin setshop @user [true/false]`')] });
      const isShop = args[2].toLowerCase() === 'true';

      const user = await getOrCreate(target.id, message.guild.id, target.username);
      user.isShopOwner = isShop;
      await user.save();
      await logAdminAction(message.author.id, message.author.displayName, message.guild.id, 'SETSHOP', target.id, `Set: ${isShop}`);

      return message.reply({ embeds: [successEmbed('🏪 Phân Quyền Thương Mại', `👤 **${target.displayName}**\nQuyền Chủ Shop: **${isShop ? 'BẬT ✅' : 'TẮT ❌'}**\n*(Họ đã có thể sử dụng lệnh đăng bán hàng).*`)] });
    }

    if (sub === 'setchannel') {
      const action = args[1]?.toLowerCase();
      const channel = message.mentions.channels.first();
      if (!['add', 'remove'].includes(action) || !channel) return message.reply({ embeds: [errorEmbed('Cú pháp: `.admin setchannel [add/remove] #channel`')] });
      
      const config = await GuildConfig.findOneAndUpdate({ guildId: message.guild.id }, {}, { upsert: true, new: true });
      
      if (action === 'add') {
        if (!config.allowedChannels.includes(channel.id)) config.allowedChannels.push(channel.id);
      } else {
        config.allowedChannels = config.allowedChannels.filter(id => id !== channel.id);
      }
      await config.save();
      await logAdminAction(message.author.id, message.author.displayName, message.guild.id, 'SETCHANNEL', null, `${action} ${channel.id}`);
      return message.reply({ embeds: [successEmbed('⚙️ Cấu Hình Kênh', `Đã **${action === 'add' ? 'THÊM' : 'XÓA'}** kênh ${channel} khỏi danh sách được phép dùng bot.\n*(Nếu danh sách trống, bot sẽ hoạt động ở mọi kênh)*`)] });
    }

    if (sub === 'coins') {
      if (!target || args.length < 3) return message.reply({ embeds: [errorEmbed('Cú pháp: `.admin coins @user [amount]`')] });
      const amount = parseInt(args[2]);
      if (isNaN(amount)) return message.reply({ embeds: [errorEmbed('Số xu không hợp lệ!')] });

      const user = await getOrCreate(target.id, message.guild.id, target.username);
      const newCoins = Math.max(0, user.coins + amount);
      user.coins = newCoins;
      await user.save();

      const action = amount >= 0 ? `+${amount}` : `${amount}`;
      await logAdminAction(message.author.id, message.author.displayName, message.guild.id, 'COINS', target.id, `Điều chỉnh: ${amount}`);
      return message.reply({ embeds: [successEmbed('✅ Đã Điều Chỉnh Xu', `👤 **${target.displayName}**\n💰 Thay đổi: **${action}** xu\n💳 Xu mới: **${newCoins.toLocaleString('vi-VN')}** xu`)] });
    }

    if (sub === 'exp') {
      if (!target || args.length < 3) return message.reply({ embeds: [errorEmbed('Cú pháp: `.admin exp @user [amount]`')] });
      const amount = parseInt(args[2]);
      if (isNaN(amount) || amount <= 0) return message.reply({ embeds: [errorEmbed('Số EXP không hợp lệ!')] });

      const user = await getOrCreate(target.id, message.guild.id, target.username);
      user.exp += amount;
      await user.save();

      const newLevel = calcLevel(user.exp);
      await logAdminAction(message.author.id, message.author.displayName, message.guild.id, 'EXP', target.id, `Cộng: ${amount}`);
      return message.reply({ embeds: [successEmbed('✅ Đã Cộng EXP', `👤 **${target.displayName}**\n⭐ +**${amount}** EXP\n🎯 Cấp độ hiện tại: **Cấp ${newLevel}**`)] });
    }

    if (sub === 'resetcd') {
      if (!target || args.length < 3) return message.reply({ embeds: [errorEmbed('Cú pháp: `.admin resetcd @user [garden|farm|sneak|all]`')] });
      const type = args[2].toLowerCase();
      if (!['garden', 'farm', 'sneak', 'all'].includes(type)) return message.reply({ embeds: [errorEmbed('Loại không hợp lệ! (garden, farm, sneak, all)')] });

      const user = await getOrCreate(target.id, message.guild.id, target.username);
      if (type === 'all' || type === 'garden') user.cooldowns.garden = null;
      if (type === 'all' || type === 'farm')   user.cooldowns.farm   = null;
      if (type === 'all' || type === 'sneak')  user.cooldowns.sneak  = null;
      await user.save();
      await logAdminAction(message.author.id, message.author.displayName, message.guild.id, 'RESETCD', target.id, `Loại: ${type}`);

      return message.reply({ embeds: [successEmbed('✅ Đã Reset Hồi Chiêu', `👤 **${target.displayName}** — Đã reset: **${type}**`)] });
    }

    if (sub === 'reset') {
      if (!target || !args[2] || args[3]?.toLowerCase() !== 'true') {
        return message.reply({ embeds: [errorEmbed('Bạn phải xác nhận `true` để xóa dữ liệu!\nCú pháp: `.admin reset @user [all/coins/inv/exp] true`')] });
      }
      const type = args[2].toLowerCase();
      if (!['all', 'coins', 'inv', 'exp'].includes(type)) return message.reply({ embeds: [errorEmbed('Loại không hợp lệ! (all / coins / inv / exp)')] });

      if (type === 'all') {
        await Promise.all([User.deleteOne({ userId: target.id, guildId: message.guild.id }), ShopListing.deleteMany({ sellerId: target.id, guildId: message.guild.id })]);
        await logAdminAction(message.author.id, message.author.displayName, message.guild.id, 'RESETDATA', target.id, `Đã xóa toàn bộ dữ liệu`);
        return message.reply({ embeds: [successEmbed('⚠️ Đã Xóa Dữ Liệu', `👤 **${target.displayName}** — Toàn bộ dữ liệu đã bị xóa.`)] });
      } else {
         const user = await getOrCreate(target.id, message.guild.id, target.username);
         if (type === 'coins') user.coins = 0;
         if (type === 'inv') user.inventory = {};
         if (type === 'exp') user.exp = 0;
         user.markModified('inventory');
         await user.save();
         await logAdminAction(message.author.id, message.author.displayName, message.guild.id, 'RESETDATA', target.id, `Xóa dữ liệu: ${type}`);
         return message.reply({ embeds: [successEmbed('⚠️ Đã Xóa Dữ Liệu', `👤 **${target.displayName}** — Đã xóa dữ liệu: **${type.toUpperCase()}**.`)] });
      }
    }

    if (sub === 'stats') {
      const [totalPlayers, totalListings, richest, mostBaked, topLevel, totalCoinsAll] = await Promise.all([
        User.countDocuments({ guildId: message.guild.id }),
        ShopListing.countDocuments({ guildId: message.guild.id }),
        User.findOne({ guildId: message.guild.id }).sort({ coins: -1 }).select('username coins').lean(),
        User.findOne({ guildId: message.guild.id }).sort({ 'stats.totalBaked': -1 }).select('username stats').lean(),
        User.findOne({ guildId: message.guild.id }).sort({ exp: -1 }).select('username exp').lean(),
        User.aggregate([{ $match: { guildId: message.guild.id } }, { $group: { _id: null, total: { $sum: '$coins' } } }]),
      ]);

      const totalCoins = totalCoinsAll[0]?.total || 0;
      return message.reply({
        embeds: [bakeryEmbed(
          `📊 Thống Kê Server — ${message.guild.name}`,
          [
            `> *Tổng quan hoạt động của Tiệm Bánh Mộng Mơ* 🍰`,
            '',
            `**👥 Người chơi:** ${totalPlayers}`,
            `**🏬 Listing đang bán:** ${totalListings}`,
            `**💰 Tổng xu lưu thông:** ${totalCoins.toLocaleString('vi-VN')} xu`,
            '',
            `**🏆 Kỷ lục**`,
            richest   ? `💰 Giàu nhất: **${richest.username}** — ${richest.coins.toLocaleString('vi-VN')} xu` : '',
            mostBaked ? `🧁 Nướng nhiều nhất: **${mostBaked.username}** — ${mostBaked.stats.totalBaked} bánh` : '',
            topLevel  ? `⭐ Cấp cao nhất: **${topLevel.username}** — ${topLevel.exp.toLocaleString()} EXP` : '',
          ].filter(Boolean).join('\n'),
          COLORS.gold,
        )],
      });
    }

    if (sub === 'ban') {
      if (!target) return message.reply({ embeds: [errorEmbed('Cú pháp: `.admin ban @user [ly_do]`')] });
      if (target.id === message.author.id) return message.reply({ embeds: [errorEmbed('Không thể tự ban mình!')] });

      const reason = args.slice(2).join(' ') || 'Không có lý do';
      await User.findOneAndUpdate(
        { userId: target.id, guildId: message.guild.id },
        { $set: { banned: true, banReason: reason } },
        { upsert: true },
      );
      await logAdminAction(message.author.id, message.author.displayName, message.guild.id, 'BAN', target.id, `Lý do: ${reason}`);
      return message.reply({ embeds: [bakeryEmbed('🔨 Đã Cấm Người Chơi', `👤 **${target.displayName}** bị cấm.\n📝 Lý do: *${reason}*\n\n*(Dùng \`.admin unban\` để bỏ cấm)*`, COLORS.error)] });
    }

    if (sub === 'unban') {
      if (!target) return message.reply({ embeds: [errorEmbed('Cú pháp: `.admin unban @user`')] });
      await User.findOneAndUpdate(
        { userId: target.id, guildId: message.guild.id },
        { $unset: { banned: '', banReason: '' } },
        { upsert: true },
      );
      await logAdminAction(message.author.id, message.author.displayName, message.guild.id, 'UNBAN', target.id, `Bỏ cấm`);
      return message.reply({ embeds: [successEmbed('✅ Đã Bỏ Cấm', `👤 **${target.displayName}** có thể sử dụng bot trở lại.`)] });
    }

    if (sub === 'broadcast') {
      if (args.length < 3) return message.reply({ embeds: [errorEmbed('Cú pháp: `!admin broadcast "tiêu đề" "nội dung"`\n*(Gợi ý: Dùng dấu `/` cho lệnh này để nhập tin dài dễ hơn)*')] });
      return message.reply({ content: '⚠️ Chức năng broadcast hỗ trợ nhập tin nhắn dài tốt nhất qua dấu `/`. Xin hãy dùng `/admin broadcast`!' });
    }

    if (sub === 'logs') {
      const query = { guildId: message.guild.id };
      if (target) query.adminId = target.id;
      
      const logs = await AdminLog.find(query).sort({ createdAt: -1 }).limit(15).lean();
      if (!logs.length) return message.reply({ embeds: [errorEmbed('Chưa có lịch sử thao tác nào.')] });

      const lines = logs.map(l => `\`[${new Date(l.createdAt).toLocaleString('vi-VN')}]\` **${l.adminName}** đã \`${l.action}\` ${l.targetId ? `<@${l.targetId}>` : ''} - *${l.details}*`);
      return message.reply({ embeds: [bakeryEmbed(
        '📋 Lịch Sử Admin (15 hành động gần nhất)',
        lines.join('\n\n'),
        COLORS.gold
      )] });
    }
  },

  /**
   * Xử lý toàn bộ subcommand của /admin.
   * Tất cả đã được bảo vệ bởi defaultMemberPermissions,
   * nhưng mình vẫn kiểm tra lại để phòng trường hợp DM hoặc API abuse.
   */
  async execute(interaction) {
    if (!isDev(interaction.user.id)) {
      return interaction.reply({ embeds: [errorEmbed('🔒 Truy cập bị từ chối! Yêu cầu quyền Nhà Phát Triển.')], flags: MessageFlags.Ephemeral });
    }

    const sub = interaction.options.getSubcommand();

    // ── /admin give ───────────────────────────────────────────────────────────
    if (sub === 'give') {
      const target  = interaction.options.getUser('nguoi_choi');
      const itemKey = interaction.options.getString('vat_pham').trim().toLowerCase();
      const qty     = interaction.options.getInteger('so_luong');

      // Validate item key
      if (!ALL_ITEM_KEYS.includes(itemKey)) {
        return interaction.reply({
          embeds: [errorEmbed(`Item **${itemKey}** không tồn tại!\nDanh sách hợp lệ: nguyên liệu, bánh thường, shiny_bánh.`)],
          flags: MessageFlags.Ephemeral,
        });
      }

      const user = await getOrCreate(target.id, interaction.guildId, target.username);
      user.inventory[itemKey] = (user.inventory[itemKey] || 0) + qty;
      user.markModified('inventory');
      await user.save();

      const info  = getItemInfo(itemKey);
      const label = info ? `${info.emoji} ${info.name}` : itemKey;

      await interaction.reply({
        embeds: [successEmbed(
          '✅ Đã Tặng Vật Phẩm',
          [
            `👤 **${target.displayName}** nhận được:`,
            `${label} × **${qty}**`,
            `💳 Kho hiện tại: **${user.inventory[itemKey]}**`,
          ].join('\n'),
        )],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── /admin setshop ────────────────────────────────────────────────────────
    else if (sub === 'setshop') {
      const target = interaction.options.getUser('nguoi_choi');
      const isShop = interaction.options.getBoolean('quyen_han');

      const user = await getOrCreate(target.id, interaction.guildId, target.username);
      user.isShopOwner = isShop;
      await user.save();

      await interaction.reply({
        embeds: [successEmbed('🏪 Phân Quyền Thương Mại', `👤 **${target.displayName}**\nQuyền Chủ Shop: **${isShop ? 'BẬT ✅' : 'TẮT ❌'}**`)],
      });
    }

    // ── /admin setchannel ─────────────────────────────────────────────────────
    else if (sub === 'setchannel') {
      const action  = interaction.options.getString('hanh_dong');
      const channel = interaction.options.getChannel('kenh');
      const config  = await GuildConfig.findOneAndUpdate({ guildId: interaction.guildId }, {}, { upsert: true, new: true });

      if (action === 'add') {
        if (!config.allowedChannels.includes(channel.id)) config.allowedChannels.push(channel.id);
      } else {
        config.allowedChannels = config.allowedChannels.filter(id => id !== channel.id);
      }
      await config.save();
      await interaction.reply({ embeds: [successEmbed('⚙️ Cấu Hình Kênh', `Đã **${action === 'add' ? 'THÊM' : 'XÓA'}** kênh ${channel} khỏi danh sách được phép dùng bot.\n*(Nếu danh sách trống, bot sẽ hoạt động ở mọi kênh)*`)], flags: MessageFlags.Ephemeral });
    }

    // ── /admin coins ──────────────────────────────────────────────────────────
    else if (sub === 'coins') {
      const target = interaction.options.getUser('nguoi_choi');
      const amount = interaction.options.getInteger('so_luong');

      const user = await getOrCreate(target.id, interaction.guildId, target.username);

      // Không cho phép xu âm
      const newCoins = Math.max(0, user.coins + amount);
      user.coins     = newCoins;
      await user.save();

      const action = amount >= 0 ? `+${amount}` : `${amount}`;
      await interaction.reply({
        embeds: [successEmbed(
          '✅ Đã Điều Chỉnh Xu',
          [
            `👤 **${target.displayName}**`,
            `💰 Thay đổi: **${action}** xu`,
            `💳 Xu mới: **${newCoins.toLocaleString('vi-VN')}** xu`,
          ].join('\n'),
        )],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── /admin exp ────────────────────────────────────────────────────────────
    else if (sub === 'exp') {
      const target = interaction.options.getUser('nguoi_choi');
      const amount = interaction.options.getInteger('so_luong');

      const user = await getOrCreate(target.id, interaction.guildId, target.username);
      user.exp  += amount;
      await user.save();

      const newLevel = calcLevel(user.exp);
      await interaction.reply({
        embeds: [successEmbed(
          '✅ Đã Cộng EXP',
          [
            `👤 **${target.displayName}**`,
            `⭐ +**${amount}** EXP`,
            `🎯 Cấp độ hiện tại: **Cấp ${newLevel}**`,
          ].join('\n'),
        )],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── /admin resetcd ────────────────────────────────────────────────────────
    else if (sub === 'resetcd') {
      const target = interaction.options.getUser('nguoi_choi');
      const type   = interaction.options.getString('loai');

      const user = await User.findOneAndUpdate(
        { userId: target.id, guildId: interaction.guildId },
        { $setOnInsert: { username: target.username } },
        { upsert: true, new: true },
      );

      // Reset cooldown theo loại được chọn
      const label = { garden: '🌿 Khu Vườn', farm: '🏡 Trang Trại', sneak: '🐾 Trộm', all: '🔄 Tất Cả' };
      if (type === 'all' || type === 'garden') user.cooldowns.garden = null;
      if (type === 'all' || type === 'farm')   user.cooldowns.farm   = null;
      if (type === 'all' || type === 'sneak')  user.cooldowns.sneak  = null;
      await user.save();

      await interaction.reply({
        embeds: [successEmbed(
          '✅ Đã Reset Hồi Chiêu',
          `👤 **${target.displayName}** — Đã reset hồi chiêu: **${label[type]}**`,
        )],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── /admin reset ──────────────────────────────────────────────────────────
    else if (sub === 'reset') {
      const target  = interaction.options.getUser('nguoi_choi');
      const type    = interaction.options.getString('loai');
      const confirm = interaction.options.getBoolean('xac_nhan');

      if (!confirm) {
        return interaction.reply({
          embeds: [errorEmbed('Bạn phải chọn xác nhận là True để xóa dữ liệu!')],
          flags: MessageFlags.Ephemeral,
        });
      }

      if (type === 'all') {
        await Promise.all([User.deleteOne({ userId: target.id, guildId: interaction.guildId }), ShopListing.deleteMany({ sellerId: target.id, guildId: interaction.guildId })]);
        await interaction.reply({
          embeds: [successEmbed('⚠️ Đã Xóa Dữ Liệu', `👤 **${target.displayName}** — Toàn bộ dữ liệu game đã bị xóa.\n*(Bao gồm: kho đồ, xu, EXP, shop listings)*`)],
          flags: MessageFlags.Ephemeral,
        });
      } else {
        const user = await getOrCreate(target.id, interaction.guildId, target.username);
        if (type === 'coins') user.coins = 0;
        if (type === 'inv') user.inventory = {};
        if (type === 'exp') user.exp = 0;
        user.markModified('inventory');
        await user.save();
        await interaction.reply({
          embeds: [successEmbed('⚠️ Đã Xóa Dữ Liệu', `👤 **${target.displayName}** — Đã xóa dữ liệu: **${type.toUpperCase()}**.`)],
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    // ── /admin stats ──────────────────────────────────────────────────────────
    else if (sub === 'stats') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      // Truy vấn thống kê song song để giảm latency
      const [
        totalPlayers,
        totalListings,
        richest,
        mostBaked,
        topLevel,
        totalCoinsAll,
      ] = await Promise.all([
        User.countDocuments({ guildId: interaction.guildId }),
        ShopListing.countDocuments({ guildId: interaction.guildId }),
        User.findOne({ guildId: interaction.guildId }).sort({ coins: -1 }).select('username coins').lean(),
        User.findOne({ guildId: interaction.guildId }).sort({ 'stats.totalBaked': -1 }).select('username stats').lean(),
        User.findOne({ guildId: interaction.guildId }).sort({ exp: -1 }).select('username exp').lean(),
        User.aggregate([
          { $match: { guildId: interaction.guildId } },
          { $group: { _id: null, total: { $sum: '$coins' } } },
        ]),
      ]);

      const totalCoins = totalCoinsAll[0]?.total || 0;

      await interaction.editReply({
        embeds: [bakeryEmbed(
          `📊 Thống Kê Server — ${interaction.guild.name}`,
          [
            `> *Tổng quan hoạt động của Tiệm Bánh Mộng Mơ* 🍰`,
            '',
            `**👥 Người chơi:** ${totalPlayers}`,
            `**🏬 Listing đang bán:** ${totalListings}`,
            `**💰 Tổng xu lưu thông:** ${totalCoins.toLocaleString('vi-VN')} xu`,
            '',
            `**🏆 Kỷ lục**`,
            richest   ? `💰 Giàu nhất: **${richest.username}** — ${richest.coins.toLocaleString('vi-VN')} xu` : '',
            mostBaked ? `🧁 Nướng nhiều nhất: **${mostBaked.username}** — ${mostBaked.stats.totalBaked} bánh` : '',
            topLevel  ? `⭐ Cấp cao nhất: **${topLevel.username}** — ${topLevel.exp.toLocaleString()} EXP` : '',
          ].filter(Boolean).join('\n'),
          COLORS.gold,
        )],
      });
    }

    // ── /admin ban ────────────────────────────────────────────────────────────
    else if (sub === 'ban') {
      const target = interaction.options.getUser('nguoi_choi');
      const reason = interaction.options.getString('ly_do') || 'Không có lý do';

      if (target.id === interaction.user.id) {
        return interaction.reply({ embeds: [errorEmbed('Không thể tự ban mình!')], ephemeral: true });
      }

      await User.findOneAndUpdate(
        { userId: target.id, guildId: interaction.guildId },
        { $set: { banned: true, banReason: reason } },
        { upsert: true },
      );

      await interaction.reply({
        embeds: [bakeryEmbed(
          '🔨 Đã Cấm Người Chơi',
          [
            `👤 **${target.displayName}** đã bị cấm sử dụng bot.`,
            `📝 Lý do: *${reason}*`,
            '',
            `*(Dùng \`/admin unban\` để bỏ cấm)*`,
          ].join('\n'),
          COLORS.error,
        )],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── /admin unban ──────────────────────────────────────────────────────────
    else if (sub === 'unban') {
      const target = interaction.options.getUser('nguoi_choi');

      await User.findOneAndUpdate(
        { userId: target.id, guildId: interaction.guildId },
        { $unset: { banned: '', banReason: '' } },
        { upsert: true },
      );

      await interaction.reply({
        embeds: [successEmbed(
          '✅ Đã Bỏ Cấm',
          `👤 **${target.displayName}** có thể sử dụng bot trở lại.`,
        )],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ── /admin broadcast ──────────────────────────────────────────────────────
    else if (sub === 'broadcast') {
      const title   = interaction.options.getString('tieu_de');
      const content = interaction.options.getString('noi_dung');
      const colorKey = interaction.options.getString('mau_sac') || 'primary';

      // Thay \n (văn bản) thành xuống dòng thật
      const formattedContent = content.replace(/\\n/g, '\n');

      await interaction.reply({
        embeds: [bakeryEmbed(title, formattedContent, COLORS[colorKey])
          .setAuthor({ name: `📢 Thông báo từ ${interaction.user.displayName}`, iconURL: interaction.user.displayAvatarURL() })],
      });
    }
  },
};
