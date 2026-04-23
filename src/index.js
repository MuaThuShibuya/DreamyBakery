'use strict';
/**
 * @file index.js
 * @description Entry point của Tiệm Bánh Mộng Mơ Discord Bot.
 *
 * Kiến trúc:
 *  - Discord.js v14 với Slash Commands (Application Commands)
 *  - Tự động load tất cả command files từ thư mục /commands
 *  - Router trung tâm phân luồng: ChatInputCommand, Button, SelectMenu, Modal, Autocomplete
 *  - Express keep-alive server để tránh Render free tier sleep
 *  - Kết nối MongoDB qua Mongoose
 *
 * Quy ước customId cho components: "<commandName>:<action>:<params...>"
 */

require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const path = require('path');
const fs   = require('fs');

const { connectDB }      = require('./database');
const { startKeepAlive } = require('./keepalive');
const User               = require('./models/User');

// ─── Khởi tạo Discord Client ─────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // YÊU CẦU BẮT BUỘC CHO LỆNH !
  ],
});

/** Map lưu tất cả command objects, key = commandName */
client.commands = new Collection();

// ─── Load Command Files ──────────────────────────────────────────────────────

const commandsDir   = path.join(__dirname, 'commands');
const commandFiles  = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const cmd = require(path.join(commandsDir, file));
  if (cmd.data && cmd.execute) {
    client.commands.set(cmd.data.name, cmd);
    console.log(`  ✅ Loaded: /${cmd.data.name}`);
  }
}

// ─── Event: Bot sẵn sàng ────────────────────────────────────────────────────

client.once('ready', () => {
  console.log(`\n✨ ${client.user.tag} đã đăng nhập thành công!`);
  console.log(`📡 Đang phục vụ ${client.guilds.cache.size} server(s)\n`);

  // Đặt trạng thái bot
  client.user.setPresence({
    activities: [{ name: '🍰 Tiệm Bánh Mộng Mơ (Official) | Dùng /help', type: 0 }],
    status:     'online',
  });
});

// ─── Message Handler (Tiền tố !) ─────────────────────────────────────────────

client.on('messageCreate', async (message) => {
  // Bỏ qua bot và tin nhắn DMs
  if (!message.guild || message.author.bot) return;
  
  const prefix = '!';
  if (!message.content.startsWith(prefix)) return;

  // Tách tên lệnh và tham số
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const cmd = client.commands.get(commandName);
  if (!cmd) return;

  // Kiểm tra user có bị ban không
  if (commandName !== 'admin') {
    const dbUser = await User.findOne({ userId: message.author.id, guildId: message.guild.id }).lean();
    if (dbUser?.banned) {
      return message.reply(`🔨 Bạn đã bị cấm sử dụng bot.\n📝 Lý do: *${dbUser.banReason || 'Không có lý do'}*`);
    }
  }

  try {
    // Gọi hàm executeMessage cho lệnh có tiền tố !
    if (cmd.executeMessage) {
      await cmd.executeMessage(message, args);
    } else {
      message.reply('⚠️ Lệnh này đang được nâng cấp để hỗ trợ dấu `!`. Vui lòng dùng lệnh gạch chéo `/` tạm thời nhé!');
    }
  } catch (err) {
    console.error(`[MessageError] ${commandName}:`, err);
    message.reply('❌ Có lỗi xảy ra khi thực hiện lệnh!');
  }
});

// ─── Interaction Handler (Router) ────────────────────────────────────────────

client.on('interactionCreate', async (interaction) => {
  try {
    // Bỏ qua DM (bot chỉ hoạt động trong server)
    if (!interaction.guildId) return;

    // Kiểm tra user có bị ban không (bỏ qua với admin commands)
    if (
      (interaction.isChatInputCommand() || interaction.isButton() || interaction.isStringSelectMenu()) &&
      interaction.commandName !== 'admin'
    ) {
      const dbUser = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId })
        .select('banned banReason')
        .lean();
      if (dbUser?.banned) {
        const reason = dbUser.banReason || 'Không có lý do';
        return interaction.reply({
          content: `🔨 Bạn đã bị cấm sử dụng bot.\n📝 Lý do: *${reason}*\nLiên hệ Admin server để được hỗ trợ.`,
          ephemeral: true,
        });
      }
    }

    // 1. Slash Commands
    if (interaction.isChatInputCommand()) {
      const cmd = client.commands.get(interaction.commandName);
      if (!cmd) return;
      await cmd.execute(interaction);
      return;
    }

    // 2. Autocomplete (gõ option để gợi ý)
    if (interaction.isAutocomplete()) {
      const cmd = client.commands.get(interaction.commandName);
      if (cmd?.autocomplete) await cmd.autocomplete(interaction);
      return;
    }

    // 3. Button và Select Menu — Router theo prefix của customId
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      let isOriginalUser = true;
      const msg = interaction.message;

      // Nếu là tin nhắn phản hồi lệnh Slash Command
      if (msg.interaction) {
        isOriginalUser = msg.interaction.user.id === interaction.user.id;
      } 
      // Nếu là tin nhắn phản hồi lệnh Prefix Command (!lệnh)
      else if (msg.reference && msg.reference.messageId) {
        if (msg.mentions && msg.mentions.repliedUser) {
          isOriginalUser = msg.mentions.repliedUser.id === interaction.user.id;
        } else {
          try {
            const originalMsg = await interaction.channel.messages.fetch(msg.reference.messageId);
            isOriginalUser = originalMsg.author.id === interaction.user.id;
          } catch (err) {
            isOriginalUser = false; // Lỗi không tìm thấy tin nhắn gốc (đã xóa), khóa nút cho an toàn
          }
        }
      }

      if (!isOriginalUser) {
        return interaction.reply({ content: '⚠️ Nút này không dành cho bạn! Vui lòng tự gõ lệnh để sử dụng nhé. 🌸', ephemeral: true });
      }

      const prefix = interaction.customId.split(':')[0];
      const cmd    = client.commands.get(prefix);
      if (cmd?.handleComponent) await cmd.handleComponent(interaction);
      return;
    }

    // 4. Modal Submit — Router theo prefix của customId
    if (interaction.isModalSubmit()) {
      const prefix = interaction.customId.split(':')[0];
      const cmd    = client.commands.get(prefix);
      if (cmd?.handleModal) await cmd.handleModal(interaction);
      return;
    }

  } catch (err) {
    console.error(`[InteractionError] ${interaction.customId || interaction.commandName}:`, err);

    // Gửi thông báo lỗi thân thiện cho user
    const errPayload = {
      content:   '❌ Có lỗi xảy ra! Thử lại sau nhé~ 🌸',
      ephemeral: true,
    };
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errPayload);
      } else {
        await interaction.reply(errPayload);
      }
    } catch { /* ignore secondary errors */ }
  }
});

// ─── Xử lý lỗi không bắt được (tránh crash) ────────────────────────────────

process.on('unhandledRejection', (err) => {
  console.error('[UnhandledRejection]', err);
});

process.on('uncaughtException', (err) => {
  console.error('[UncaughtException]', err);
  // Không thoát — để bot tiếp tục chạy nếu lỗi không nghiêm trọng
});

// ─── Bootstrap ───────────────────────────────────────────────────────────────

(async () => {
  console.log('🍰 Đang khởi động Tiệm Bánh Mộng Mơ...\n');

  // Kết nối MongoDB
  await connectDB();

  // Khởi Express keep-alive server (cho Render free tier)
  startKeepAlive();

  // Đăng nhập Discord
  await client.login(process.env.DISCORD_TOKEN);
})();
