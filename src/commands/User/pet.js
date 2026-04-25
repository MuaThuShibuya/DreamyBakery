'use strict';
/**
 * @file pet.js
 * @description Hệ thống Thú cưng: Gacha, Cường hóa bằng Bánh, và PvP Thú cưng.
 */

const { SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');
const User = require('../../models/User');
const { bakeryEmbed, errorEmbed, successEmbed, btn, row, selectMenu } = require('../../utils/embeds');
const { PETS, PET_RANKS, BAKED_GOODS, BAKED_KEYS, COLORS } = require('../../utils/constants');
const { getItemInfo } = require('../../utils/gameUtils');

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
        const stars = activePet.stars || 0;
        const starStr = stars > 0 ? `[${'🌟'.repeat(Math.min(stars, 5))}${stars > 5 ? `+${stars-5}` : ''}]` : '';
        
        desc += `🐾 **Đồng Hành:** ${info.emoji} **${activePet.name}** [Hạng ${info.rank} ${rankInfo.color}] ${starStr}\n`;
        desc += `⭐ **Cấp:** ${activePet.level}  |  🌟 **Sao:** ${stars}  |  ✨ **EXP:** ${activePet.exp}/${activePet.level * 100}\n`;
        desc += `⚔️ **Lực chiến (BP):** ${bp}\n`;
        desc += `❤️ **HP:** ${activePet.stats.hp} | 🗡️ **ATK:** ${activePet.stats.atk} | 🛡️ **DEF:** ${activePet.stats.def} | 💨 **SPD:** ${activePet.stats.spd}`;
      } else {
        desc += `*Bạn chưa có thú cưng nào. Hãy ấp trứng ngay nhé!*`;
      }

      const btns = row(
        btn('pet:gacha_1', `🥚 Ấp 1 Lần`, 'Primary', user.coins < GACHA_COST),
        btn('pet:gacha_10', `🥚 Ấp 10 Lần`, 'Success', user.coins < GACHA_COST * 10),
        btn('pet:list', `📖 Kho Pet (${user.pets.length})`, 'Secondary', user.pets.length === 0),
        btn('pet:feed_menu', '🧁 Cường Hóa (Cho ăn)', 'Success', !activePet),
      );
      return interaction.update({ embeds: [bakeryEmbed('🐾 Trại Thú Cưng', desc, COLORS.success)], components: [btns] });
    }

    // ── 2. Gacha (Ấp Trứng x1 và x10) ─────────────────────────────────────
    if (action === 'gacha_1' || action === 'gacha_10') {
      await interaction.deferUpdate();
      const rolls = action === 'gacha_10' ? 10 : 1;
      const totalCost = GACHA_COST * rolls;

      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      if (user.coins < totalCost) return interaction.editReply({ embeds: [errorEmbed(`Bạn cần **${totalCost.toLocaleString()} xu**!`)] });

      user.coins -= totalCost;
      
      let highestRank = 'B';
      let results = [];

      for (let i = 0; i < rolls; i++) {
        const petKey = rollPet();
        const petInfo = PETS[petKey];
        if (PET_RANKS[petInfo.rank].multiplier > PET_RANKS[highestRank].multiplier) highestRank = petInfo.rank;
        
        const newPet = { _id: new mongoose.Types.ObjectId(), petKey, name: petInfo.name, level: 1, exp: 0, stats: { ...petInfo.baseStats } };
        user.pets.push(newPet);
        if (!user.activePetId) user.activePetId = newPet._id;
        results.push(`${petInfo.emoji} ${petInfo.name} [${petInfo.rank}]`);
      }

      await user.save();

      return interaction.editReply({
        embeds: [successEmbed(`🥚 Trứng Nở (${rolls} Lần)!`, `Bạn vừa ấp thành công ${rolls} trứng! Hạng cao nhất: **${highestRank}**\n\n` + results.join('  |  '))],
        components: [row(btn('pet:open', '🐾 Quay lại Trại Thú', 'Primary'))]
      });
    }

    // ── Kho Pet & Chọn Pet ────────────────────────────────────────────────
    if (action === 'list') {
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const options = user.pets.slice(0, 25).map(p => {
        const info = PETS[p.petKey];
        return { label: `${info.emoji} ${p.name} (Lv.${p.level} | ${p.stars || 0}🌟)`, description: `Hạng ${info.rank} - Lực chiến: ${calcBP(p.stats)}`, value: p._id.toString() };
      });
      return interaction.update({
        embeds: [bakeryEmbed('📖 Kho Thú Cưng', 'Chọn một Thú Cưng để đặt làm Đồng Hành chính:', COLORS.primary)],
        components: [row(selectMenu('pet:select', '🐾 Đặt làm Đồng Hành...', options)), row(btn('pet:open', '◀ Quay Lại', 'Secondary'))]
      });
    }

    if (action === 'select') {
      const petId = interaction.values[0];
      await User.updateOne({ userId: interaction.user.id, guildId: interaction.guildId }, { activePetId: petId });
      interaction.customId = 'pet:open'; // Gọi lại màn chính
      return this.handleComponent(interaction);
    }

    // ── 3. Menu Cường Hóa (Chọn Bánh) ─────────────────────────────────────
    if (action === 'feed_menu') {
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const options = [];
      const allCakes = [...BAKED_KEYS, ...BAKED_KEYS.map(k => `shiny_${k}`)];

      for (const k of allCakes) {
        if ((user.inventory[k] || 0) > 0) {
          const info = getItemInfo(k);
          const expGain = info.type === 'shiny' ? info.shinyPrice : info.basePrice;
          options.push({ label: `${info.emoji} ${info.name.substring(0, 50)}`, description: `+${expGain} EXP (Có: ${user.inventory[k]})`, value: k });
        }
      }

      if (!options.length) return interaction.update({ embeds: [errorEmbed('Bạn không có bánh nào để cho Pet ăn! Hãy đi nướng thêm nhé.')], components: [row(btn('pet:open', '◀ Quay Lại', 'Secondary'))] });
      
      return interaction.update({
        embeds: [bakeryEmbed('🧁 Cường Hóa Thú Cưng', 'Chọn bánh để cho ăn. Bánh Thượng Hạng sẽ giúp thú cưng **Đột Phá Sao (🌟)**!', COLORS.warning)],
        components: [row(selectMenu('pet:feed_do', '🧁 Chọn bánh để cho ăn...', options.slice(0, 25))), row(btn('pet:open', '◀ Quay Lại', 'Secondary'))]
      });
    }

    // ── 4. Thực Hiện Cho Ăn ───────────────────────────────────────────────
    if (action === 'feed_do') {
      await interaction.deferUpdate();
      const itemKey = interaction.values[0];
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const activePet = getActivePet(user);

      if (!activePet || (user.inventory[itemKey] || 0) < 1) return interaction.editReply({ embeds: [errorEmbed('Thao tác không hợp lệ!')], components: [row(btn('pet:open', '◀ Quay Lại', 'Secondary'))] });

      const info = getItemInfo(itemKey);
      const isShiny = info.type === 'shiny';
      const expGain = isShiny ? info.shinyPrice : info.basePrice; // EXP tăng bằng giá trị bánh
      
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

      let msg = `${PETS[activePet.petKey].emoji} **${activePet.name}** đã ăn ngon lành **${info.name}** và nhận được **+${expGain} EXP**!`;
      if (leveledUp) msg += `\n🌟 **LÊN CẤP!** Thú cưng đã đạt **Cấp ${activePet.level}**! Các chỉ số đã tăng vọt!`;

      // Đột phá Phẩm Chất Sao (Tăng chỉ số cực lớn nếu ăn bánh shiny)
      if (isShiny) {
        activePet.stars = (activePet.stars || 0) + 1;
        const starBonus = activePet.stars * 2;
        activePet.stats.hp  += 50 * starBonus;
        activePet.stats.atk += 10 * starBonus;
        activePet.stats.def += 10 * starBonus;
        activePet.stats.spd += 10 * starBonus;
        msg += `\n\n✨ **ĐỘT PHÁ PHẨM CHẤT!** Thú cưng đạt **${activePet.stars} Sao 🌟**! Các chỉ số gốc tăng mạnh vĩnh viễn!`;
      }

      // Phải chỉ định cho Mongoose biết array subdocument đã bị thay đổi
      const petIndex = user.pets.findIndex(p => p._id.toString() === activePet._id.toString());
      user.pets[petIndex] = activePet;
      user.markModified('pets');
      await user.save();

      return interaction.editReply({
        embeds: [successEmbed('🍽️ Cho Ăn Thành Công!', msg)],
        components: [row(btn('pet:feed_menu', 'Tiếp tục cho ăn', 'Primary'), btn('pet:open', 'Quay lại Trại', 'Secondary'))]
      });
    }
  }
};

// Engine Mô phỏng trận đấu Thú Cưng (Turn-based)
module.exports.petBattleEngine = async function(interaction, attackerUser, victimUser, mode, betAmount = 0) {
  const aPet = getActivePet(attackerUser);
  const vPet = getActivePet(victimUser);
  
  if (!aPet || !vPet) return { error: 'Một trong hai người chưa trang bị Thú Cưng!\nVào **Trại Thú Cưng** để ấp trứng trước.' };

  // Kiểm tra cược xu
  if (mode === 'bet') {
    if (attackerUser.coins < betAmount) return { error: `Bạn không đủ **${betAmount.toLocaleString()} xu** để cược!` };
    if (victimUser.coins < betAmount) return { error: `Đối thủ quá nghèo, không đủ **${betAmount.toLocaleString()} xu** để cược với bạn!` };
  }

  // Kiểm tra hồi chiêu Úp sọt
  if (mode === 'force') {
    const now = Date.now();
    const cd = attackerUser.cooldowns?.pet_force ? new Date(attackerUser.cooldowns.pet_force).getTime() : 0;
    if (cd > now) return { error: `🐾 Thú cưng của bạn đang dưỡng thương! Hãy chờ **${Math.ceil((cd - now)/60000)} phút** nữa mới có thể đi Úp Sọt tiếp.` };
  }

  // Khởi tạo chỉ số (Nhân 5 HP để đánh được nhiều lượt)
  let aHp = aPet.stats.hp * 5;
  let vHp = vPet.stats.hp * 5;
  const aMaxHp = aHp, vMaxHp = vHp;

  let log = [];
  let turn = 0;
  let isA_Turn = aPet.stats.spd >= vPet.stats.spd; // Tốc độ cao đánh trước

  // Vòng lặp trận đấu (Tối đa 10 hiệp để tránh spam text)
  while(aHp > 0 && vHp > 0 && turn < 10) {
    turn++;
    let atk = isA_Turn ? aPet : vPet;
    let def = isA_Turn ? vPet : aPet;
    
    let skillName = "Đánh Thường";
    let damage = Math.max(1, atk.stats.atk - def.stats.def * 0.5);
    let heal = 0;
    let r = Math.random();
    const rank = PETS[atk.petKey].rank;

    // Kỹ năng theo phẩm chất
    if (['S', 'SS', 'SSS'].includes(rank) && r < 0.20) {
        skillName = "✨ Tuyệt Kỹ Tối Thượng";
        damage = atk.stats.atk * 2.5; // Bỏ qua giáp
        if (rank === 'SSS') heal = atk.stats.hp * 0.5; // Hồi máu
    } else if (r < 0.40) {
        skillName = "💥 Đòn Đặc Trưng";
        damage = Math.max(5, atk.stats.atk * 1.5 - def.stats.def * 0.3);
    }

    // Biến thiên sát thương +-10%
    damage = Math.floor(damage * (0.9 + Math.random() * 0.2));
    
    if (isA_Turn) vHp -= damage; else aHp -= damage;
    if (heal > 0) {
        if (isA_Turn) aHp = Math.min(aMaxHp, aHp + heal); else vHp = Math.min(vMaxHp, vHp + heal);
    }

    let actionLog = `**${atk.name}** tung *${skillName}* ➝ **-${damage} HP**`;
    if (heal > 0) actionLog += ` 💚(+${Math.floor(heal)} HP)`;
    log.push(actionLog);

    isA_Turn = !isA_Turn;
  }

  const isWin = aHp > vHp;
  let resultMsg = "";

  // Trả thưởng
  if (mode === 'bet') {
     if (isWin) {
        await User.updateOne({ userId: attackerUser.userId, guildId: attackerUser.guildId }, { $inc: { coins: betAmount } });
        await User.updateOne({ userId: victimUser.userId, guildId: victimUser.guildId }, { $inc: { coins: -betAmount } });
        resultMsg = `🎉 Thắng cược! Nhận được **${betAmount.toLocaleString()} xu** từ đối thủ!`;
     } else {
        await User.updateOne({ userId: attackerUser.userId, guildId: attackerUser.guildId }, { $inc: { coins: -betAmount } });
        await User.updateOne({ userId: victimUser.userId, guildId: victimUser.guildId }, { $inc: { coins: betAmount } });
        resultMsg = `💀 Thua cược! Mất trắng **${betAmount.toLocaleString()} xu** vào tay đối thủ!`;
     }
  } else if (mode === 'force') {
     attackerUser.cooldowns.pet_force = new Date(Date.now() + 60 * 60 * 1000); // 1 giờ CD
     if (isWin) {
        const stolen = Math.floor(victimUser.coins * (0.01 + Math.random() * 0.04)); // Cướp 1-5%
        await User.updateOne({ userId: attackerUser.userId, guildId: attackerUser.guildId }, { $inc: { coins: stolen }, $set: { 'cooldowns.pet_force': attackerUser.cooldowns.pet_force } });
        await User.updateOne({ userId: victimUser.userId, guildId: victimUser.guildId }, { $inc: { coins: -stolen } });
        resultMsg = `🏴‍☠️ Úp sọt thành công! Cướp được **${stolen.toLocaleString()} xu**!`;
     } else {
        const penalty = Math.floor(attackerUser.coins * 0.05); // Phạt 5%
        await User.updateOne({ userId: attackerUser.userId, guildId: attackerUser.guildId }, { $inc: { coins: -penalty }, $set: { 'cooldowns.pet_force': attackerUser.cooldowns.pet_force } });
        await User.updateOne({ userId: victimUser.userId, guildId: victimUser.guildId }, { $inc: { coins: penalty } });
        resultMsg = `🚑 Bị phản đam! Phải đền bù thuốc men **${penalty.toLocaleString()} xu** cho nạn nhân!`;
     }
  }

  return { isWin, log, resultMsg, aPet, vPet, aHp: Math.max(0, aHp), vHp: Math.max(0, vHp), aMaxHp, vMaxHp };
};