'use strict';
/**
 * @file pet.js
 * @description Hệ thống Thú cưng: Gacha, Cường hóa bằng Bánh, và PvP Thú cưng.
 */

const { SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');
const User = require('../models/User');
const { bakeryEmbed, errorEmbed, successEmbed, btn, row, selectMenu } = require('../utils/embeds');
const { PETS, PET_RANKS, BAKED_GOODS, BAKED_KEYS, COLORS } = require('../utils/constants');

/** Cấu hình Gacha */
const GACHA_COST = 2000;
const GACHA_RATES = [
  { rank: 'SSS', chance: 0.01 }, // 1%
  { rank: 'SS',  chance: 0.04 }, // 4%
  { rank: 'S',   chance: 0.10 }, // 10%
  { rank: 'A',   chance: 0.25 }, // 25%
  { rank: 'B',   chance: 0.60 }, // 60%
];

/** Roll Gacha */
function rollPet() {
  const rand = Math.random();
  let cumulative = 0;
  let rolledRank = 'B';
  for (const rate of GACHA_RATES) {
    cumulative += rate.chance;
    if (rand <= cumulative) { rolledRank = rate.rank; break; }
  }
  const pool = Object.keys(PETS).filter(k => PETS[k].rank === rolledRank);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Lấy Active Pet của user */
function getActivePet(user) {
  if (!user.activePetId || !user.pets.length) return null;
  return user.pets.find(p => p._id.toString() === user.activePetId.toString()) || user.pets[0];
}

/** Tính Lực Chiến (BP) */
function calcBP(stats) {
  return Math.floor(stats.atk * 2 + stats.def * 1.5 + stats.spd * 1.5 + stats.hp * 0.5);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pet')
    .setDescription('🐾 Quản lý và huấn luyện Thú Cưng'),

  async execute(interaction) {
    return interaction.reply({ content: 'Vui lòng sử dụng qua Bảng điều khiển trung tâm (`!menu`).', ephemeral: true });
  },

  async handleComponent(interaction) {
    const parts = interaction.customId.split(':');
    const action = parts[1];

    // ── 1. Mở Trại Thú Cưng ───────────────────────────────────────────────
    if (action === 'open') {
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const activePet = getActivePet(user);

      let desc = `> *Chào mừng đến với Trại Huấn Luyện! Ấp trứng, cho ăn và sẵn sàng chiến đấu.* 🐾\n\n`;
      if (activePet) {
        const info = PETS[activePet.petKey];
        const rankInfo = PET_RANKS[info.rank];
        const bp = calcBP(activePet.stats);
        desc += `🌟 **Pet Đồng Hành:** ${info.emoji} **${activePet.name}** [Hạng ${info.rank} ${rankInfo.color}]\n`;
        desc += `⭐ **Cấp:** ${activePet.level}  |  ✨ **EXP:** ${activePet.exp}/${activePet.level * 100}\n`;
        desc += `⚔️ **Lực chiến (BP):** ${bp}\n`;
        desc += `❤️ **HP:** ${activePet.stats.hp} | 🗡️ **ATK:** ${activePet.stats.atk} | 🛡️ **DEF:** ${activePet.stats.def} | 💨 **SPD:** ${activePet.stats.spd}`;
      } else {
        desc += `*Bạn chưa có thú cưng nào. Hãy ấp trứng ngay nhé!*`;
      }

      const btns = row(
        btn('pet:gacha', `🥚 Ấp Trứng (${GACHA_COST} xu)`, 'Primary', user.coins < GACHA_COST),
        btn('pet:feed_menu', '🧁 Cường Hóa (Cho ăn)', 'Success', !activePet),
        btn('menu:home', '◀ Quay Lại Menu', 'Secondary')
      );
      return interaction.update({ embeds: [bakeryEmbed('🐾 Trại Thú Cưng', desc, COLORS.success)], components: [btns] });
    }

    // ── 2. Gacha (Ấp Trứng) ───────────────────────────────────────────────
    if (action === 'gacha') {
      await interaction.deferUpdate();
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      if (user.coins < GACHA_COST) return interaction.editReply({ embeds: [errorEmbed('Không đủ xu để ấp trứng!')] });

      const petKey = rollPet();
      const petInfo = PETS[petKey];
      user.coins -= GACHA_COST;
      
      const newPet = {
        _id: new mongoose.Types.ObjectId(),
        petKey,
        name: petInfo.name,
        level: 1,
        exp: 0,
        stats: { ...petInfo.baseStats }
      };

      user.pets.push(newPet);
      if (!user.activePetId) user.activePetId = newPet._id;
      await user.save();

      const rankColor = PET_RANKS[petInfo.rank].color;
      return interaction.editReply({
        embeds: [successEmbed('🥚 Trứng Nở Bất Ngờ!', `Chúc mừng! Bạn đã nhận được:\n\n${petInfo.emoji} **${petInfo.name}**\n🏆 **Hạng:** ${petInfo.rank} ${rankColor}\n\n*Thú cưng đã được thêm vào đội hình của bạn!*`)],
        components: [row(btn('pet:open', '🐾 Quay lại Trại Thú', 'Primary'))]
      });
    }

    // ── 3. Menu Cường Hóa (Chọn Bánh) ─────────────────────────────────────
    if (action === 'feed_menu') {
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const options = BAKED_KEYS.filter(k => (user.inventory[k] || 0) > 0).map(k => {
        const info = BAKED_GOODS[k];
        return { label: `${info.emoji} ${info.name}`, description: `+${info.basePrice} EXP (Có: ${user.inventory[k]})`, value: k };
      });

      if (!options.length) return interaction.update({ embeds: [errorEmbed('Bạn không có bánh nào để cho Pet ăn! Hãy đi nướng thêm nhé.')] });
      
      return interaction.update({
        embeds: [bakeryEmbed('🧁 Cường Hóa Thú Cưng', 'Chọn một chiếc bánh để bồi dưỡng sức mạnh cho Pet của bạn. Bánh càng xịn, lượng EXP nhận được càng nhiều!', COLORS.warning)],
        components: [row(selectMenu('pet:feed_do', '🧁 Chọn bánh để cho ăn...', options)), row(btn('pet:open', '◀ Quay Lại', 'Secondary'))]
      });
    }

    // ── 4. Thực Hiện Cho Ăn ───────────────────────────────────────────────
    if (action === 'feed_do') {
      await interaction.deferUpdate();
      const itemKey = interaction.values[0];
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const activePet = getActivePet(user);

      if (!activePet || (user.inventory[itemKey] || 0) < 1) return interaction.editReply({ embeds: [errorEmbed('Thao tác không hợp lệ!')] });

      const cakeInfo = BAKED_GOODS[itemKey];
      const expGain = cakeInfo.basePrice; // EXP tăng bằng giá trị bánh
      
      user.inventory[itemKey] -= 1;
      user.markModified('inventory');

      activePet.exp += expGain;
      let leveledUp = false;
      const rankMult = PET_RANKS[PETS[activePet.petKey].rank].multiplier;

      // Xử lý Lên Cấp
      while (activePet.exp >= activePet.level * 100) {
        activePet.exp -= activePet.level * 100;
        activePet.level += 1;
        activePet.stats.hp  += Math.floor(10 * rankMult);
        activePet.stats.atk += Math.floor(3 * rankMult);
        activePet.stats.def += Math.floor(2 * rankMult);
        activePet.stats.spd += Math.floor(2 * rankMult);
        leveledUp = true;
      }

      // Phải chỉ định cho Mongoose biết array subdocument đã bị thay đổi
      const petIndex = user.pets.findIndex(p => p._id.toString() === activePet._id.toString());
      user.pets[petIndex] = activePet;
      user.markModified('pets');
      await user.save();

      let msg = `${PETS[activePet.petKey].emoji} **${activePet.name}** đã ăn ngon lành **${cakeInfo.name}** và nhận được **+${expGain} EXP**!`;
      if (leveledUp) msg += `\n\n🌟 **LÊN CẤP!** Thú cưng đã đạt **Cấp ${activePet.level}**! Các chỉ số đã tăng vọt!`;

      return interaction.editReply({
        embeds: [successEmbed('🍽️ Cho Ăn Thành Công!', msg)],
        components: [row(btn('pet:feed_menu', 'Tiếp tục cho ăn', 'Primary'), btn('pet:open', 'Quay lại Trại', 'Secondary'))]
      });
    }
  }
};

// Cung cấp hàm battle ra ngoài để gọi từ menu.js
module.exports.petBattle = async function(attackerUser, victimUser) {
  const aPet = getActivePet(attackerUser);
  const vPet = getActivePet(victimUser);
  if (!aPet || !vPet) return null; // Một trong hai không có Pet

  const aBP = calcBP(aPet.stats) * (0.85 + Math.random() * 0.3); // RNG +- 15%
  const vBP = calcBP(vPet.stats) * (0.85 + Math.random() * 0.3);

  return { aPet, vPet, isWin: aBP > vBP, aBP: Math.floor(aBP), vBP: Math.floor(vBP) };
};