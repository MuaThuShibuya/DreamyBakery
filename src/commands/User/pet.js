'use strict';
/**
 * @file pet.js
 * @description Hệ thống Thú cưng: Gacha, Cường hóa bằng Bánh, và PvP Thú cưng.
 */

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const User = require('../../models/User');
const { bakeryEmbed, errorEmbed, successEmbed, btn, row, selectMenu } = require('../../utils/embeds');
const { PETS, PET_RANKS, TRAITS, TRAIT_LEVEL_RATES, SKILL_BOOKS, GEAR_SETS, GEARS, BAKED_GOODS, BAKED_KEYS, COLORS } = require('../../utils/constants');
const { getItemInfo } = require('../../utils/gameUtils');

/** Cấu hình Gacha */
const GACHA_COST = 2000;
const GACHA_RATES = [
  { rank: 'SSS+', chance: 0.001 }, // 0.1%
  { rank: 'SSS',  chance: 0.010 }, // 1%
  { rank: 'SS',   chance: 0.040 }, // 4%
  { rank: 'S',    chance: 0.100 }, // 10%
  { rank: 'A',    chance: 0.250 }, // 25%
  { rank: 'B',    chance: 0.599 }, // 59.9%
];

/** Roll Gacha */
function rollPet(user) {
  user.gachaPitySSSP = (user.gachaPitySSSP || 0) + 1;
  user.gachaPitySSS = (user.gachaPitySSS || 0) + 1;
  let rolledRank = 'B';
  if (user.gachaPitySSSP >= 1500) {
    rolledRank = 'SSS+';
    user.gachaPitySSSP = 0;
    user.gachaPitySSS = 0;
  } else if (user.gachaPitySSS >= 150) {
    rolledRank = 'SSS';
    user.gachaPitySSS = 0;
  } else {
    const rand = Math.random();
    let cumulative = 0;
    for (const rate of GACHA_RATES) {
      cumulative += rate.chance;
      if (rand <= cumulative) { rolledRank = rate.rank; break; }
    }
    if (rolledRank === 'SSS+') { user.gachaPitySSSP = 0; user.gachaPitySSS = 0; }
    if (rolledRank === 'SSS') { user.gachaPitySSS = 0; }
  }
  const pool = Object.keys(PETS).filter(k => PETS[k].rank === rolledRank);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Lấy Active Pet của user */
function getActivePet(user) {
  if (!user.activePetId || !user.pets.length) return null;
  return user.pets.find(p => p._id.toString() === user.activePetId.toString()) || user.pets[0];
}

/** Tính toán toàn bộ chỉ số thực của Pet (Bao gồm Gốc, Đặc Tính, và Trang Bị) */
function getPetTotalStats(pet) {
  let hp = pet.stats.hp, atk = pet.stats.atk, def = pet.stats.def, spd = pet.stats.spd;

  // 1. Đặc Tính (Traits áp dụng lên cơ bản)
  if (pet.trait && pet.trait.id && TRAITS[pet.trait.id]) {
    const t = TRAITS[pet.trait.id];
    const mult = 1 - (5 - pet.trait.level) * 0.05;
    hp += pet.stats.hp * t.effects.hp * mult;
    atk += pet.stats.atk * t.effects.atk * mult;
    def += pet.stats.def * t.effects.def * mult;
    spd += pet.stats.spd * t.effects.spd * mult;
  }

  // 2. Trang bị (Cộng thẳng)
  let gearHp = 0, gearAtk = 0, gearDef = 0, gearSpd = 0;
  const setsCount = {};
  if (pet.equipment) {
    for (const slot of ['weapon', 'head', 'armor', 'accessory']) {
      const gearId = pet.equipment[slot];
      if (gearId && GEARS[gearId]) {
        const g = GEARS[gearId];
        if (g.stats.hp) gearHp += g.stats.hp;
        if (g.stats.atk) gearAtk += g.stats.atk;
        if (g.stats.def) gearDef += g.stats.def;
        if (g.stats.spd) gearSpd += g.stats.spd;
        setsCount[g.set] = (setsCount[g.set] || 0) + 1;
      }
    }
  }
  hp += gearHp; atk += gearAtk; def += gearDef; spd += gearSpd;

  // 3. Hiệu ứng bộ (Phần trăm áp dụng lên tổng hiện tại)
  for (const [setName, count] of Object.entries(setsCount)) {
    const setInfo = GEAR_SETS[setName];
    if (count >= 2) {
       if (setInfo[2].hp) hp += hp * setInfo[2].hp;
       if (setInfo[2].atk) atk += atk * setInfo[2].atk;
       if (setInfo[2].def) def += def * setInfo[2].def;
       if (setInfo[2].spd) spd += spd * setInfo[2].spd;
    }
    if (count >= 4) {
       if (setInfo[4].hp) hp += hp * setInfo[4].hp;
       if (setInfo[4].atk) atk += atk * setInfo[4].atk;
       if (setInfo[4].def) def += def * setInfo[4].def;
       if (setInfo[4].spd) spd += spd * setInfo[4].spd;
    }
  }

  return { hp: Math.floor(hp), atk: Math.floor(atk), def: Math.floor(def), spd: Math.floor(spd), setsCount };
}

/** Tính Lực Chiến (BP) */
function calcBP(pet) {
  const s = getPetTotalStats(pet);
  return Math.floor(s.atk * 2 + s.def * 1.5 + s.spd * 1.5 + s.hp * 0.5);
}

/** Cập nhật BP cao nhất */
function updateHighestBP(user) {
  let highest = user.stats.highestBP || 0;
  for (const p of user.pets) {
    const bp = calcBP(p);
    if (bp > highest) highest = bp;
  }
  user.stats.highestBP = highest;
}

/**
 * Sinh phần thưởng ngẫu nhiên khi vượt qua Tháp Aincrad.
 * @param {number} floor - Tầng hiện tại
 * @returns {{type: string, amount?: number, id?: string}}
 */
function getTowerReward(floor) {
    const rand = Math.random();
    // Tăng phần thưởng cơ bản và cơ hội nhận đồ xịn theo tầng
    let reward = { type: 'coins', amount: 200 + floor * 100 }; 

    const gearChance = 0.05 + Math.min(0.15, (floor / 50) * 0.15); // Max 20%
    const skillBookChance = 0.03 + Math.min(0.12, (floor / 50) * 0.12); // Max 15%
    const crystalChance = 0.20 + Math.min(0.20, (floor / 50) * 0.20); // Max 40%

    if (rand < gearChance) {
        const allGears = Object.keys(GEARS);
        const gearId = allGears[Math.floor(Math.random() * allGears.length)];
        reward = { type: 'gear', id: gearId };
    } else if (rand < gearChance + skillBookChance) {
        const allSkills = Object.keys(SKILL_BOOKS);
        const skillId = allSkills[Math.floor(Math.random() * allSkills.length)];
        reward = { type: 'skill', id: skillId };
    } else if (rand < gearChance + skillBookChance + crystalChance) {
        const amount = 1 + Math.floor(floor / 10);
        reward = { type: 'crystal', amount };
    }
    
    return reward;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pet')
    .setDescription('🐾 Quản lý và huấn luyện Thú Cưng'),

  async execute(interaction) {
    return interaction.reply({ content: 'Vui lòng sử dụng qua Bảng điều khiển trung tâm (`.menu`).', flags: MessageFlags.Ephemeral });
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
        const stars = activePet.stars || 0;
        const starStr = stars > 0 ? `[${'🌟'.repeat(Math.min(stars, 5))}${stars > 5 ? `+${stars-5}` : ''}]` : '';
        
        desc += `🐾 **Đồng Hành:** ${info.emoji} **${activePet.name}** [Hạng ${info.rank} ${rankInfo.color}] ${starStr}\n`;
        desc += `⭐ **Cấp:** ${activePet.level}  |  ⚔️ **Lực chiến:** ${calcBP(activePet)}\n`;
      } else {
        desc += `*Bạn chưa có thú cưng nào. Hãy ấp trứng ngay nhé!*`;
      }
      desc += `\n\n🎯 **Pity:** Đảm bảo SSS (${user.gachaPitySSS || 0}/150) | SSS+ (${user.gachaPitySSSP || 0}/1500)\n`;
      desc += `💎 **Tinh Thể:** ${user.crystals || 0}`;
      desc += `\n> 💡 *Để đấu PvP hoặc Úp Sọt, hãy ra ngoài mục Xã Hội và chọn người chơi nhé!*`;

      const btns1 = row(
        btn(activePet ? `pet:view_pet:${activePet._id}` : 'pet:view_pet:none', '🐾 Thông Tin Pet', 'Success', !activePet),
        btn('pet:gacha_1', `🥚 Ấp 1 Lần`, 'Primary', user.coins < GACHA_COST),
        btn('pet:gacha_10', `🥚 Ấp 10 Lần`, 'Primary', user.coins < GACHA_COST * 10)
      );
      const btns2 = row(
        btn('pet:list:0:ALL', `🎒 Kho Pet (${user.pets.length})`, 'Secondary', user.pets.length === 0),
        btn('pet:dex', '📖 Pokedex', 'Secondary')
      );
      const btns3 = row(
        btn('pet:gear_shop', '🛡️ Shop Trang Bị', 'Primary'),
        btn('menu:home', '◀ Về Menu', 'Secondary')
      );
      
      try {
        return await interaction.update({
          embeds: [bakeryEmbed('🐾 Trại Thú Cưng', desc, COLORS.success)],
          components: [btns1, btns2, btns3]
        });
      } catch (e) {
        if (e.code === 40060 || e.code === 10062 || e.code === 'InteractionAlreadyReplied') return;
        throw e;
      }
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
        const petKey = rollPet(user);
        const petInfo = PETS[petKey];
        if (PET_RANKS[petInfo.rank].multiplier > PET_RANKS[highestRank].multiplier) highestRank = petInfo.rank;
        
        // Chỉ số dao động ngẫu nhiên ±15%
        const potential = 0.85 + Math.random() * 0.3;
        const rStat = (val) => Math.floor(val * potential);
        const newPet = { 
          _id: new mongoose.Types.ObjectId(), 
          petKey, 
          name: petInfo.name, 
          level: 1, 
          exp: 0, 
          stats: { hp: rStat(petInfo.baseStats.hp), atk: rStat(petInfo.baseStats.atk), def: rStat(petInfo.baseStats.def), spd: rStat(petInfo.baseStats.spd) },
          skills: [],
          equipment: { weapon: null, head: null, armor: null, accessory: null }
        };
        user.pets.push(newPet);
        if (!user.activePetId) user.activePetId = newPet._id;
        results.push(`${petInfo.emoji} ${petInfo.name} [${petInfo.rank}] — Tố chất: **${Math.floor(potential * 100)}%**`);
      }

      updateHighestBP(user);
      await user.save();

      return interaction.editReply({
        embeds: [successEmbed(`🥚 Trứng Nở (${rolls} Lần)!`, `Bạn vừa ấp thành công ${rolls} trứng! Hạng cao nhất: **${highestRank}**\n\n` + results.join('  |  '))],
        components: [row(btn(`pet:gacha_${rolls === 10 ? '10' : '1'}`, `🥚 Ấp Tiếp (${rolls} Lần)`, rolls === 10 ? 'Success' : 'Primary'), btn('pet:open', '🐾 Quay lại Trại Thú', 'Secondary'))]
      });
    }

    if (action === 'dex') {
      const ranks = ['B', 'A', 'S', 'SS', 'SSS', 'SSS+'];
      let desc = `> *Danh sách toàn bộ Thú Cưng và Lực Chiến (BP) cơ bản ở Cấp 1*\n\n`;
      
      for (const rank of ranks) {
        const petsInRank = Object.values(PETS).filter(p => p.rank === rank);
        if (petsInRank.length === 0) continue;
        
        desc += `**Hạng ${rank} ${PET_RANKS[rank].color}**\n`;
        const lines = petsInRank.map(p => {
           const baseBp = Math.floor(p.baseStats.atk*2 + p.baseStats.def*1.5 + p.baseStats.spd*1.5 + p.baseStats.hp*0.5);
           return `> ${p.emoji} **${p.name}** — BP: ${baseBp}`;
        });
        desc += lines.join('\n') + '\n\n';
      }
      
      return interaction.update({
        embeds: [bakeryEmbed('📖 Pokedex - Từ Điển Thú Cưng', desc, COLORS.primary)],
        components: [row(btn('pet:open', '◀ Quay Lại Trại Thú', 'Secondary'))]
      });
    }

    // ── Kho Pet & Chọn Pet ────────────────────────────────────────────────
    if (action === 'list') {
      const page = parseInt(parts[2]) || 0;
      const currentFilter = parts[3] || 'ALL'; // Lọc theo ALL, SSS, SS, S, A, B
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });

      if (user.pets.length === 0) {
        return interaction.update({
          embeds: [errorEmbed('Bạn chưa có Thú Cưng nào! Hãy ấp trứng nhé.')],
          components: [row(btn('pet:open', '◀ Quay Lại', 'Secondary'))]
        });
      }

      let filteredPets = user.pets;
      if (currentFilter !== 'ALL') {
        filteredPets = user.pets.filter(p => PETS[p.petKey].rank === currentFilter);
      }

      const totalPets = filteredPets.length;
      const maxPage = Math.max(0, Math.ceil(totalPets / 25) - 1);
      const safePage = Math.max(0, Math.min(page, maxPage));

      const options = filteredPets.slice(safePage * 25, (safePage + 1) * 25).map(p => {
        const info = PETS[p.petKey];
        const lockStr = p.isLocked ? '🔒 ' : '';
        return { label: `${lockStr}${info.emoji} ${p.name} (Lv.${p.level} | ${p.stars || 0}🌟)`, description: `Hạng ${info.rank} - Lực chiến: ${calcBP(p)}`, value: p._id.toString() };
      });

      const components = [];
      
      // Dropdown chọn pet
      if (options.length > 0) {
        components.push(row(selectMenu('pet:view_pet', '🐾 Chọn xem thông tin thú cưng...', options)));
      }
      
      // Dropdown Lọc phẩm chất
      const filterOptions = [
        { label: 'Tất cả phẩm chất', emoji: '🌈', value: 'ALL', default: currentFilter === 'ALL' },
        { label: 'Lọc Hạng SSS+ (Vượt Trội)', emoji: '🔴', value: 'SSS+', default: currentFilter === 'SSS+' },
        { label: 'Lọc Hạng SSS (Tối thượng)', emoji: '🟡', value: 'SSS', default: currentFilter === 'SSS' },
        { label: 'Lọc Hạng SS (Thần thú)', emoji: '🟣', value: 'SS', default: currentFilter === 'SS' },
        { label: 'Lọc Hạng S (Linh thú)', emoji: '🔵', value: 'S', default: currentFilter === 'S' },
        { label: 'Lọc Hạng A (Hoang dã)', emoji: '🟢', value: 'A', default: currentFilter === 'A' },
        { label: 'Lọc Hạng B (Cơ bản)', emoji: '⚪', value: 'B', default: currentFilter === 'B' }
      ];
      components.push(row(selectMenu('pet:filter_select', '🔍 Lọc hiển thị theo phẩm chất...', filterOptions)));

      // Dropdown chuyển trang
      if (maxPage > 0) {
        const pageOptions = [];
        const limit = Math.min(maxPage + 1, 25); // Tối đa 25 option trong dropdown
        for (let i = 0; i < limit; i++) {
          pageOptions.push({
            label: `Trang ${i + 1}`,
            description: `Hiển thị thú cưng từ ${i * 25 + 1} đến ${Math.min((i + 1) * 25, totalPets)}`,
            value: i.toString(),
            default: i === safePage
          });
        }
        components.push(row(selectMenu(`pet:page_select:${currentFilter}`, '📑 Nhảy nhanh đến trang...', pageOptions)));
      }

      components.push(row(
        btn('pet:mass_release_menu', '🕊️ Phóng Sinh Hàng Loạt', 'Danger'),
        btn('pet:open', '◀ Quay Lại Trại Thú', 'Secondary')
      ));

      let desc = `**🎒 TỔNG QUAN KHO THÚ CƯNG**\n`;
      desc += `🐾 Tổng số Pet: **${user.pets.length}**\n`;
      desc += `🔍 Bộ lọc đang bật: **${currentFilter === 'ALL' ? 'Tất cả' : `Hạng ${currentFilter} ${PET_RANKS[currentFilter].color}`}**\n\n`;
      desc += `> *Sử dụng menu bên dưới để chọn xem chi tiết một bé Pet, hoặc đổi bộ lọc.*`;
      
      if (currentFilter !== 'ALL' && totalPets === 0) desc += `\n\n⚠️ *(Bạn chưa có thú cưng nào thuộc Hạng ${currentFilter} cả!)*`;

      return interaction.update({
        embeds: [bakeryEmbed(`📖 Quản Lý Thú Cưng (Trang ${safePage + 1}/${maxPage + 1})`, desc, COLORS.primary)],
        components
      });
    }
    
    // ── Cửa Hàng Kỹ Năng ────────────────────────────────────────────────
    if (action === 'skill_shop') {
      const options = Object.entries(SKILL_BOOKS).map(([k, s]) => {
        return { label: `${s.emoji} ${s.name}`, description: `${s.price.toLocaleString()} xu - ${s.desc}`, value: k };
      });
      return interaction.update({
        embeds: [bakeryEmbed('📜 Cửa Hàng Kỹ Năng', '> *Mua sách kỹ năng để giúp thú cưng mạnh mẽ hơn trong chiến đấu!*\n\nChọn kỹ năng muốn mua bên dưới:', COLORS.gold)],
        components: [row(selectMenu('pet:buy_skill', '🛒 Chọn kỹ năng muốn mua...', options)), row(btn('pet:open', '◀ Quay Lại', 'Secondary'))]
      });
    }

    if (action === 'buy_skill') {
      const skillId = interaction.values[0];
      const skillInfo = SKILL_BOOKS[skillId];
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const activePet = getActivePet(user);

      if (!activePet) return interaction.reply({ embeds: [errorEmbed('Bạn chưa chọn thú cưng đồng hành để học kỹ năng!')], flags: MessageFlags.Ephemeral });
      if (user.coins < skillInfo.price) return interaction.reply({ embeds: [errorEmbed(`Bạn cần **${skillInfo.price.toLocaleString()} xu** để mua cuốn sách này!`)], flags: MessageFlags.Ephemeral });
      if (activePet.skills && activePet.skills.includes(skillId)) return interaction.reply({ embeds: [errorEmbed(`Thú cưng **${activePet.name}** đã học kỹ năng này rồi!`)], flags: MessageFlags.Ephemeral });

      user.coins -= skillInfo.price;
      const petIndex = user.pets.findIndex(p => p._id.toString() === activePet._id.toString());
      if (!user.pets[petIndex].skills) user.pets[petIndex].skills = [];
      user.pets[petIndex].skills.push(skillId);
      user.markModified('pets');
      await user.save();

      return interaction.update({
        embeds: [successEmbed('🎓 Học Thành Công!', `Thú cưng **${activePet.name}** đã học thành công **${skillInfo.emoji} ${skillInfo.name}**!\nKỹ năng này sẽ tự động kích hoạt ngẫu nhiên trong các trận đấu.`)],
        components: [row(btn('pet:skill_shop', '🛒 Mua Tiếp', 'Primary'), btn('pet:open', '◀ Quay Lại Trại', 'Secondary'))]
      });
    }

    // ── Tháp Aincrad (Boss SAO) ──────────────────────────────────────────
    if (action === 'tower') {
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const floor = user.towerFloor || 1;
      const bossHp = 500 + floor * 250;
      const bossAtk = 50 + floor * 30;
      
      const desc = [
        `🏰 **THÁP AINCRAD — TẦNG ${floor}**`,
        `> *Mỗi tầng đều có những hộ vệ mạnh mẽ. Đánh bại chúng để thăng tiến và nhận Tinh Thể!*`,
        ``,
        `👹 **Hộ Vệ Tầng ${floor}**`,
        `❤️ HP: **${bossHp}**  |  🗡️ ATK: **${bossAtk}**`,
        ``,
        `*Bạn đã sẵn sàng khiêu chiến chưa?*`
      ].join('\n');

      return interaction.update({
        embeds: [bakeryEmbed(`🏰 Tháp Aincrad`, desc, COLORS.danger)],
        components: [row(btn('pet:tower_fight', '⚔️ Vào Đánh', 'Danger'), btn('menu:home', '◀ Về Menu', 'Secondary'))]
      });
    }

    if (action === 'tower_fight') {
      await interaction.deferUpdate();
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const floor = user.towerFloor || 1;
      
      const bossUser = {
        userId: 'boss', guildId: interaction.guildId, username: `Hộ Vệ Tầng ${floor}`,
        coins: 0, activePetId: 'boss_pet',
        pets: [{
          _id: 'boss_pet', name: `Boss Tầng ${floor}`, petKey: 'dark_dragon', level: floor * 5,
          stats: { hp: 500 + floor * 250, atk: 50 + floor * 30, def: 20 + floor * 15, spd: 20 + floor * 10 },
          skills: floor >= 5 ? ['skill_heavy'] : []
        }]
      };

      const result = await petBattleEngine(interaction, user, bossUser, 'tower');
      if (result.error) return interaction.editReply({ embeds: [errorEmbed(result.error)], components: [row(btn('pet:tower', '◀ Quay Lại', 'Secondary'))] });

      let msg = `⚔️ Bạn đã thách thức **Hộ Vệ Tầng ${floor}**!\n\n`;
      msg += result.log.map((l, i) => `*Lượt ${i+1}:* ${l}`).join('\n') + '\n\n';
      msg += `❤️ **${result.aPet.name}:** ${Math.floor(result.aHp)}/${result.aMaxHp} HP  |  ❤️ **Boss:** ${Math.floor(result.vHp)}/${result.vMaxHp} HP\n\n`;
      
      if (result.isWin) {
        user.towerFloor = floor + 1;
        user.crystals = (user.crystals || 0) + 1;
        await user.save();
        msg += `🎉 **CHIẾN THẮNG!** Bạn đã vượt qua tầng ${floor} và nhận được **1 Tinh Thể (💎)**!`;
      } else {
        msg += `💀 **THẤT BẠI!** Thú cưng của bạn đã kiệt sức. Hãy nâng cấp sức mạnh và thử lại!`;
      }

      return interaction.editReply({
        embeds: [bakeryEmbed(`🏰 Kết Quả Tầng ${floor}`, msg, result.isWin ? COLORS.success : COLORS.error)],
        components: [row(btn('pet:tower', '🔄 Tiếp Tục Tháp', 'Primary'), btn('menu:home', '◀ Về Menu', 'Secondary'))]
      });
    }

    if (action === 'filter_select') {
      const selectedFilter = interaction.values[0];
      interaction.customId = `pet:list:0:${selectedFilter}`;
      return this.handleComponent(interaction);
    }

    // Nhảy trang thông qua Dropdown
    if (action === 'page_select') {
      const currentFilter = parts[2];
      const targetPage = interaction.values[0];
      interaction.customId = `pet:list:${targetPage}:${currentFilter}`;
      return this.handleComponent(interaction);
    }

    // Xem thông tin chi tiết của 1 Pet cụ thể (Để chọn đồng hành hoặc Phóng sinh)
    if (action === 'view_pet') {
      const petId = interaction.values ? interaction.values[0] : parts[2]; // Fallback trong trường hợp redirect nội bộ
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const pet = user.pets.find(p => p._id.toString() === petId);
      
      if (!pet) return interaction.update({ embeds: [errorEmbed('Không tìm thấy thú cưng này!')], components: [row(btn('pet:list:0:ALL', '◀ Quay Lại', 'Secondary'))] });

      const info = PETS[pet.petKey];
      const bp = calcBP(pet);
      const totalStats = getPetTotalStats(pet);
      const stars = pet.stars || 0;
      const starStr = stars > 0 ? `[${'🌟'.repeat(Math.min(stars, 5))}${stars > 5 ? `+${stars-5}` : ''}]` : '';
      const isActive = user.activePetId && user.activePetId.toString() === petId;
      const isLocked = pet.isLocked || false;

      // Định giá Phóng sinh (Base + Level * 500 xu)
      const baseValue = info.rank === 'SSS+' ? 100000 : info.rank === 'SSS' ? 25000 : info.rank === 'SS' ? 10000 : info.rank === 'S' ? 5000 : info.rank === 'A' ? 2500 : 1000;
      const releaseValue = baseValue + (pet.level * 500);
      const traitStr = pet.trait && pet.trait.id && TRAITS[pet.trait.id] 
        ? `\n> ${TRAITS[pet.trait.id].emoji} **Đặc tính:** ${TRAITS[pet.trait.id].name} (Lv.${pet.trait.level})` 
        : `\n> *Chưa có Đặc tính*`;

      const eq = pet.equipment || {};
      const eqWeapon = eq.weapon ? GEARS[eq.weapon].name : 'Trống';
      const eqHead   = eq.head ? GEARS[eq.head].name : 'Trống';
      const eqArmor  = eq.armor ? GEARS[eq.armor].name : 'Trống';
      const eqAcc    = eq.accessory ? GEARS[eq.accessory].name : 'Trống';

      let setStr = [];
      for (const [sName, sCount] of Object.entries(totalStats.setsCount)) {
          if (sCount >= 2) {
             const sInfo = GEAR_SETS[sName];
             setStr.push(`${sInfo.emoji} **${sInfo.name}**: Bộ ${sCount >= 4 ? 4 : 2}`);
          }
      }
      const activeSetText = setStr.length ? `\n> 💫 **Hiệu ứng Bộ:** ${setStr.join(' | ')}` : '';
      
      let skillsStr = (pet.skills && pet.skills.length > 0) 
        ? pet.skills.map(s => `${SKILL_BOOKS[s]?.emoji || ''} ${SKILL_BOOKS[s]?.name || s}`).join(' | ')
        : '*Chưa học kỹ năng nào*';

      const desc = [
        `**${info.emoji} ${pet.name}** ${starStr} ${isLocked ? '🔒' : ''}`,
        `> Hạng: **${info.rank}** ${PET_RANKS[info.rank].color}`,
        traitStr,
        `> Cấp độ: **${pet.level}**  |  EXP: **${pet.exp}/${pet.level * 100}**`,
        `> Lực chiến (BP): **${bp}**`,
        '',
        `📜 **Kỹ năng đã học:**\n> ${skillsStr}`,
        '',
        `🛡️ **Trang Bị Hiện Tại:**`,
        `> 🗡️ Vũ khí: ${eqWeapon}  |  🪖 Mũ: ${eqHead}`,
        `> 🥋 Giáp: ${eqArmor}  |  💍 Phụ kiện: ${eqAcc}`,
        activeSetText,
        '',
        `❤️ HP: **${totalStats.hp}** | 🗡️ ATK: **${totalStats.atk}**\n🛡️ DEF: **${totalStats.def}** | 💨 SPD: **${totalStats.spd}**`,
        '',
        isActive ? `✨ *Đây đang là thú cưng đồng hành của bạn.*` : (isLocked ? `🔒 *Thú cưng này đã bị khóa bảo vệ.*` : `*Bạn có muốn đặt làm đồng hành hay phóng sinh?*`)
      ].join('\n');

      try {
        return await interaction.update({
          embeds: [bakeryEmbed('🐾 Thông Tin Thú Cưng', desc, COLORS.primary)],
          components: [
            row(
              btn(`pet:select:${petId}`, '🌟 Đồng Hành', 'Success', isActive),
              btn('pet:feed_menu', '🧁 Cường Hóa', 'Primary', !isActive),
              btn('pet:skill_shop', '📜 Học Kỹ Năng', 'Primary', !isActive),
              btn(`pet:equip_menu:${petId}`, '🎒 Mặc Trang Bị', 'Primary')
            ),
            row(
              btn(`pet:roll_trait:${petId}`, '🔮 Đổi Đặc Tính (1 💎)', 'Secondary'),
              btn(`pet:toggle_lock:${petId}`, isLocked ? '🔓 Mở Khóa' : '🔒 Khóa', isLocked ? 'Secondary' : 'Primary'),
              btn(`pet:unequip_all:${petId}`, '🔓 Tháo Hết Đồ', 'Secondary'),
              btn(`pet:release:${petId}`, `🕊️ Phóng Sinh (+${releaseValue} xu)`, 'Danger', isActive || isLocked)
            ),
            row(
              btn('pet:list:0:ALL', '🎒 Quay Lại Kho Pet', 'Secondary'),
              btn('pet:open', '🏠 Về Trại Thú', 'Secondary')
            )
          ]
        });
      } catch (e) {
        if (e.code === 40060 || e.code === 10062 || e.code === 'InteractionAlreadyReplied') return;
        throw e;
      }
    }

    if (action === 'roll_trait') {
      const petId = parts[2];
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      if ((user.crystals || 0) < 1) {
        return interaction.reply({ embeds: [errorEmbed('Bạn không có đủ Tinh Thể (💎)! Hãy đánh Boss để nhận.')], flags: MessageFlags.Ephemeral });
      }
      user.crystals -= 1;
      
      const tKeys = Object.keys(TRAITS);
      const traitId = tKeys[Math.floor(Math.random() * tKeys.length)];
      let level = 1;
      const rand = Math.random();
      let cumulative = 0;
      for (const rate of TRAIT_LEVEL_RATES) {
        cumulative += rate.chance;
        if (rand <= cumulative) { level = rate.level; break; }
      }
      
      const petIndex = user.pets.findIndex(p => p._id.toString() === petId);
      if (petIndex !== -1) {
        user.pets[petIndex].trait = { id: traitId, level };
        updateHighestBP(user);
        user.markModified('pets');
        await user.save();
      }
      
      interaction.customId = `pet:view_pet:${petId}`;
      interaction.values = null;
      return this.handleComponent(interaction);
    }

    // ── Mua Bán Trang Bị ──────────────────────────────────────────────────
    if (action === 'gear_shop') {
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const buyOptions = Object.entries(GEARS).map(([k, g]) => ({
        label: `${g.emoji} ${g.name}`,
        description: `[Bộ ${GEAR_SETS[g.set].name}] - ${g.price.toLocaleString()} xu`,
        value: k
      }));

      const sellOptions = [];
      if (user.gears) {
         for (const [k, count] of user.gears.entries()) {
             if (count > 0 && GEARS[k]) {
                 sellOptions.push({
                     label: `${GEARS[k].emoji} ${GEARS[k].name} (x${count})`,
                     description: `Bán: ${(GEARS[k].price / 2).toLocaleString()} xu`,
                     value: k
                 });
             }
         }
      }

      const comps = [
        row(selectMenu('pet:buy_gear', '🛒 Chọn trang bị muốn MUA (10,000 xu)...', buyOptions.slice(0, 25)))
      ];
      if (sellOptions.length > 0) {
        comps.push(row(selectMenu('pet:sell_gear', '💰 Chọn trang bị muốn BÁN (5,000 xu)...', sellOptions.slice(0, 25))));
      }
      comps.push(row(btn('pet:open', '◀ Quay Lại Trại Thú', 'Secondary')));

      return interaction.update({
        embeds: [bakeryEmbed('🛡️ Cửa Hàng Trang Bị', '> *Mua sắm trang bị cho Thú Cưng để kích hoạt Hiệu ứng Bộ vô cùng mạnh mẽ! Mặc đủ 2 món và 4 món cùng bộ sẽ nhận thêm buff khủng!*\n\n💰 **Xu của bạn:** ' + user.coins.toLocaleString('vi-VN'), COLORS.gold)],
        components: comps
      });
    }

    if (action === 'buy_gear') {
      const gearId = interaction.values[0];
      const gear = GEARS[gearId];
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });

      if (user.coins < gear.price) return interaction.reply({ embeds: [errorEmbed('Bạn không đủ xu để mua trang bị này!')], flags: MessageFlags.Ephemeral });

      user.coins -= gear.price;
      if (!user.gears) user.gears = new Map();
      user.gears.set(gearId, (user.gears.get(gearId) || 0) + 1);
      await user.save();

      return interaction.update({
        embeds: [successEmbed('🛒 Mua Thành Công!', `Bạn đã mua **${gear.emoji} ${gear.name}** thành công!\nĐã lưu vào Kho Trang Bị.`)],
        components: [row(btn('pet:gear_shop', '🛒 Tiếp Tục Mua Bán', 'Primary'), btn('pet:open', '◀ Quay Lại', 'Secondary'))]
      });
    }

    if (action === 'sell_gear') {
      const gearId = interaction.values[0];
      const gear = GEARS[gearId];
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });

      const count = user.gears ? user.gears.get(gearId) || 0 : 0;
      if (count < 1) return interaction.reply({ embeds: [errorEmbed('Trang bị này không còn trong kho của bạn!')], flags: MessageFlags.Ephemeral });

      const sellPrice = Math.floor(gear.price / 2);
      user.coins += sellPrice;
      user.gears.set(gearId, count - 1);
      await user.save();

      return interaction.update({
        embeds: [successEmbed('💰 Bán Thành Công!', `Bạn đã bán **${gear.emoji} ${gear.name}** và thu về **${sellPrice.toLocaleString()} xu**!`)],
        components: [row(btn('pet:gear_shop', '🛒 Tiếp Tục Mua Bán', 'Primary'), btn('pet:open', '◀ Quay Lại', 'Secondary'))]
      });
    }

    // ── Mặc Trang Bị ──────────────────────────────────────────────────
    if (action === 'equip_menu') {
      const petId = parts[2];
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });

      const equipOptions = [];
      if (user.gears) {
         for (const [k, count] of user.gears.entries()) {
             if (count > 0 && GEARS[k]) {
                 equipOptions.push({
                     label: `${GEARS[k].emoji} ${GEARS[k].name} (Sẵn: ${count})`,
                     description: `Loại: ${GEARS[k].type === 'weapon' ? 'Vũ khí' : GEARS[k].type === 'head' ? 'Mũ' : GEARS[k].type === 'armor' ? 'Giáp' : 'Phụ kiện'}`,
                     value: `${petId}:${k}`
                 });
             }
         }
      }

      if (equipOptions.length === 0) {
         return interaction.update({
            embeds: [errorEmbed('Bạn không có sẵn trang bị nào trong kho!\nHãy vào Shop Trang Bị để mua nhé.')],
            components: [row(btn(`pet:view_pet:${petId}`, '◀ Quay Lại Pet', 'Secondary'))]
         });
      }

      return interaction.update({
        embeds: [bakeryEmbed('🎒 Mặc Trang Bị', 'Chọn một trang bị từ kho để khoác lên thú cưng.\nNếu vị trí đã có đồ, món cũ sẽ tự động được cất lại vào kho.', COLORS.primary)],
        components: [
          row(selectMenu('pet:equip_do', '🎒 Chọn trang bị...', equipOptions.slice(0, 25))),
          row(btn(`pet:view_pet:${petId}`, '◀ Quay Lại', 'Secondary'))
        ]
      });
    }

    if (action === 'equip_do') {
      const [petId, gearId] = interaction.values[0].split(':');
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });

      const count = user.gears ? user.gears.get(gearId) || 0 : 0;
      if (count < 1) return interaction.reply({ embeds: [errorEmbed('Trang bị này không còn trong kho của bạn!')], flags: MessageFlags.Ephemeral });

      const petIndex = user.pets.findIndex(p => p._id.toString() === petId);
      if (petIndex === -1) return interaction.reply({ embeds: [errorEmbed('Không tìm thấy Pet!')], flags: MessageFlags.Ephemeral });

      const pet = user.pets[petIndex];
      const gearInfo = GEARS[gearId];
      const slot = gearInfo.type;

      if (!pet.equipment) pet.equipment = { weapon: null, head: null, armor: null, accessory: null };

      const oldGear = pet.equipment[slot];
      if (oldGear) {
         user.gears.set(oldGear, (user.gears.get(oldGear) || 0) + 1);
      }

      pet.equipment[slot] = gearId;
      user.gears.set(gearId, count - 1);

      updateHighestBP(user);
      user.markModified('pets');
      await user.save();

      interaction.customId = `pet:view_pet:${petId}`;
      interaction.values = null;
      return this.handleComponent(interaction);
    }

    if (action === 'unequip_all') {
      const petId = parts[2];
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });

      const petIndex = user.pets.findIndex(p => p._id.toString() === petId);
      if (petIndex === -1) return interaction.reply({ embeds: [errorEmbed('Không tìm thấy Pet!')], flags: MessageFlags.Ephemeral });

      const pet = user.pets[petIndex];
      if (!pet.equipment) return interaction.reply({ embeds: [errorEmbed('Pet này chưa mặc gì cả!')], flags: MessageFlags.Ephemeral });

      let unequipped = false;
      if (!user.gears) user.gears = new Map();

      for (const slot of ['weapon', 'head', 'armor', 'accessory']) {
         const oldGear = pet.equipment[slot];
         if (oldGear) {
            user.gears.set(oldGear, (user.gears.get(oldGear) || 0) + 1);
            pet.equipment[slot] = null;
            unequipped = true;
         }
      }

      if (!unequipped) return interaction.reply({ embeds: [errorEmbed('Pet này chưa mặc gì cả!')], flags: MessageFlags.Ephemeral });

      updateHighestBP(user);
      user.markModified('pets');
      await user.save();

      interaction.customId = `pet:view_pet:${petId}`;
      interaction.values = null;
      return this.handleComponent(interaction);
    }

    if (action === 'toggle_lock') {
      const petId = parts[2];
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const petIndex = user.pets.findIndex(p => p._id.toString() === petId);
      
      if (petIndex !== -1) {
        user.pets[petIndex].isLocked = !user.pets[petIndex].isLocked;
        user.markModified('pets');
        await user.save();
      }
      
      interaction.customId = `pet:view_pet:${petId}`;
      interaction.values = null; // Tránh nhiễu với Dropdown values
      return this.handleComponent(interaction);
    }

    if (action === 'select') {
      const petId = parts[2];
      await User.updateOne({ userId: interaction.user.id, guildId: interaction.guildId }, { activePetId: petId });
      interaction.customId = 'pet:open'; // Gọi lại màn chính
      return this.handleComponent(interaction);
    }

    if (action === 'mass_release_menu') {
       const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
       const options = [];
       ['B', 'A', 'S', 'SS', 'SSS', 'SSS+'].forEach(rank => {
          const releaseable = user.pets.filter(p => !p.isLocked && PETS[p.petKey].rank === rank && p._id.toString() !== user.activePetId?.toString());
          const count = releaseable.length;
          if (count > 0) {
             // Tính trước tổng số xu nhận được để làm UX chuyên nghiệp hơn
             const baseValue = rank === 'SSS+' ? 100000 : rank === 'SSS' ? 25000 : rank === 'SS' ? 10000 : rank === 'S' ? 5000 : rank === 'A' ? 2500 : 1000;
             const totalCoins = releaseable.reduce((sum, p) => sum + baseValue + (p.level * 500), 0);
             options.push({ 
                label: `Phóng sinh toàn bộ Hạng ${rank}`, 
                emoji: PET_RANKS[rank].color,
                description: `Số lượng: ${count} con | Thu về: ${totalCoins.toLocaleString('vi-VN')} xu`, 
                value: rank 
             });
          }
       });

       if (options.length === 0) {
          return interaction.update({
             embeds: [errorEmbed('Bạn không có thú cưng nào có thể phóng sinh!\n*(Các thú cưng đang khóa hoặc đang đồng hành sẽ được bảo vệ an toàn).*')],
             components: [row(btn('pet:list:0:ALL', '◀ Quay Lại Kho Pet', 'Secondary'))]
          });
       }

       return interaction.update({
          embeds: [bakeryEmbed('🕊️ Phóng Sinh Hàng Loạt', '> *Hãy chọn một Hạng phẩm chất bên dưới. Tất cả thú cưng thuộc Hạng này (chưa bị khóa) sẽ được thả về thiên nhiên.*\n\n⚠️ **Lưu ý:** Thao tác này **KHÔNG THỂ HOÀN TÁC**!', COLORS.error)],
          components: [
             row(selectMenu('pet:mass_release_confirm', '⚠️ Chọn Hạng Pet để phóng sinh...', options)),
             row(btn('pet:list:0:ALL', '◀ Hủy & Quay Lại Kho', 'Secondary'))
          ]
       });
    }

    if (action === 'mass_release_confirm') {
       const rankToRelease = interaction.values[0];
       const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });

       let totalCoinsGained = 0;
       let countReleased = 0;

       const newPets = [];
       for (const p of user.pets) {
          const isCompanion = user.activePetId?.toString() === p._id.toString();
          const info = PETS[p.petKey];

          if (!p.isLocked && !isCompanion && info.rank === rankToRelease) {
             const baseValue = info.rank === 'SSS+' ? 100000 : info.rank === 'SSS' ? 25000 : info.rank === 'SS' ? 10000 : info.rank === 'S' ? 5000 : info.rank === 'A' ? 2500 : 1000;
             totalCoinsGained += baseValue + (p.level * 500);
             countReleased++;
          } else {
             newPets.push(p);
          }
       }

       user.pets = newPets;
       user.coins += totalCoinsGained;
       await user.save();

       return interaction.update({
          embeds: [successEmbed('🕊️ Phóng Sinh Hoàn Tất', `Bạn đã thả tự do cho **${countReleased}** thú cưng Hạng **${rankToRelease}**.\nNhận được tổng cộng **${totalCoinsGained.toLocaleString('vi-VN')} xu**!`)],
          components: [row(btn('pet:list:0:ALL', '◀ Quay Lại Kho Pet', 'Primary'))]
       });
    }

    // Thực hiện Phóng sinh
    if (action === 'release') {
      const petId = parts[2];
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const pet = user.pets.find(p => p._id.toString() === petId);
      
      if (!pet) return interaction.update({ embeds: [errorEmbed('Thú cưng không tồn tại hoặc đã được phóng sinh!')], components: [row(btn('pet:list:0:ALL', '◀ Quay Lại', 'Secondary'))] });
      if (user.activePetId && user.activePetId.toString() === petId) {
        return interaction.update({ embeds: [errorEmbed('Không thể phóng sinh thú cưng đang đồng hành!')], components: [row(btn('pet:list:0:ALL', '◀ Quay Lại', 'Secondary'))] });
      }

      const info = PETS[pet.petKey];
      const baseValue = info.rank === 'SSS+' ? 100000 : info.rank === 'SSS' ? 25000 : info.rank === 'SS' ? 10000 : info.rank === 'S' ? 5000 : info.rank === 'A' ? 2500 : 1000;
      const releaseValue = baseValue + (pet.level * 500);

      user.coins += releaseValue;
      user.pets = user.pets.filter(p => p._id.toString() !== petId); // Loại bỏ pet khỏi mảng
      await user.save();

      return interaction.update({
        embeds: [successEmbed('🕊️ Phóng Sinh Thành Công', `Bạn đã thả tự do cho **${info.emoji} ${pet.name}** về với thiên nhiên.\nĐể cảm tạ, thú cưng đã để lại cho bạn **${releaseValue.toLocaleString()} xu**!`)],
        components: [row(btn('pet:list:0:ALL', '◀ Quay Lại Kho Pet', 'Secondary'))]
      });
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
        components: [row(selectMenu('pet:feed_qty', '🧁 Chọn bánh để cho ăn...', options.slice(0, 25))), row(btn('pet:open', '◀ Quay Lại', 'Secondary'))]
      });
    }

    if (action === 'feed_qty') {
      const itemKey = interaction.values ? interaction.values[0] : parts[2];
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const maxQty = user.inventory[itemKey] || 0;
      
      if (maxQty < 1) return interaction.update({ embeds: [errorEmbed('Bạn không còn bánh này!')], components: [row(btn('pet:feed_menu', '◀ Quay Lại', 'Secondary'))] });
      
      const info = getItemInfo(itemKey);
      const btns = [1, 5, 10].filter(q => q <= maxQty).map(q => btn(`pet:feed_do:${itemKey}:${q}`, `×${q}`, 'Primary'));
      if (maxQty > 0 && ![1, 5, 10].includes(maxQty)) btns.push(btn(`pet:feed_do:${itemKey}:${maxQty}`, `×${maxQty} Max`, 'Success'));
      
      return interaction.update({
         embeds: [bakeryEmbed('🧁 Chọn Số Lượng Bánh', `Bạn đang có **${maxQty}** ${info.emoji} **${info.name}**.\nChọn số lượng muốn cho thú cưng ăn:`, COLORS.warning)],
         components: [row(...btns), row(btn('pet:feed_menu', '◀ Quay Lại', 'Secondary'))]
      });
    }

    // ── 4. Thực Hiện Cho Ăn ───────────────────────────────────────────────
    if (action === 'feed_do') {
      await interaction.deferUpdate();
      const itemKey = parts[2];
      const qty = parseInt(parts[3]);
      const user = await User.findOne({ userId: interaction.user.id, guildId: interaction.guildId });
      const activePet = getActivePet(user);

      if (!activePet || (user.inventory[itemKey] || 0) < qty) return interaction.editReply({ embeds: [errorEmbed('Thao tác không hợp lệ!')], components: [row(btn('pet:open', '◀ Quay Lại', 'Secondary'))] });

      const info = getItemInfo(itemKey);
      const isShiny = info.type === 'shiny';
      const expGain = (isShiny ? info.shinyPrice : info.basePrice) * qty; 
      
      user.inventory[itemKey] -= qty;
      user.markModified('inventory');

      activePet.exp += expGain;
      let leveledUp = false;
      const rankMult = PET_RANKS[PETS[activePet.petKey].rank].multiplier;

      // Xử lý Lên Cấp
      let oldLevel = activePet.level;
      while (activePet.exp >= activePet.level * 100) {
        activePet.exp -= activePet.level * 100;
        activePet.level += 1;
        activePet.stats.hp  += Math.floor(10 * rankMult);
        activePet.stats.atk += Math.floor(3 * rankMult);
        activePet.stats.def += Math.floor(2 * rankMult);
        activePet.stats.spd += Math.floor(2 * rankMult);
        leveledUp = true;
      }

      let msg = `${PETS[activePet.petKey].emoji} **${activePet.name}** đã ăn ngon lành **${qty}x ${info.name}** và nhận được **+${expGain} EXP**!`;
      if (leveledUp) msg += `\n🌟 **LÊN CẤP!** Thú cưng đã đạt **Cấp ${activePet.level}** (Tăng ${activePet.level - oldLevel} cấp)!`;

      // Đột phá Phẩm Chất Sao (Tăng chỉ số cực lớn nếu ăn bánh shiny)
      if (isShiny) {
        activePet.stars = (activePet.stars || 0) + qty;
        let addedHp = 0, addedAtk = 0;
        for (let i=0; i<qty; i++) {
           const curStar = activePet.stars - qty + 1 + i;
           const sBonus = curStar * 2;
           addedHp += 50 * sBonus;
           addedAtk += 10 * sBonus;
        }
        activePet.stats.hp += addedHp;
        activePet.stats.atk += addedAtk;
        activePet.stats.def += addedAtk;
        activePet.stats.spd += addedAtk;
        msg += `\n\n✨ **ĐỘT PHÁ PHẨM CHẤT!** Thú cưng đạt **${activePet.stars} Sao 🌟**! Các chỉ số gốc tăng mạnh vĩnh viễn!`;
      }

      // Phải chỉ định cho Mongoose biết array subdocument đã bị thay đổi
      const petIndex = user.pets.findIndex(p => p._id.toString() === activePet._id.toString());
      user.pets[petIndex] = activePet;
      updateHighestBP(user);
      user.markModified('pets');
      await user.save();

      return interaction.editReply({
        embeds: [successEmbed('🍽️ Cho Ăn Thành Công!', msg)],
        components: [row(btn(`pet:feed_qty:${itemKey}`, 'Tiếp tục cho ăn bánh này', 'Primary'), btn('pet:feed_menu', 'Chọn bánh khác', 'Secondary'))]
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

  // Kiểm tra giới hạn thách đấu (3 lần / 1 tiếng)
  if (mode === 'force' || mode === 'bet') {
    const now = Date.now();
    if (attackerUser.pvpTime && (now - new Date(attackerUser.pvpTime).getTime()) < 3600000) {
      if (attackerUser.pvpCount >= 3) return { error: `⏳ Thú cưng cần nghỉ ngơi! Bạn chỉ có thể thách đấu/cướp **3 lần mỗi giờ**.` };
    } else {
      attackerUser.pvpCount = 0;
      attackerUser.pvpTime = new Date(now);
    }
  }

  const aStats = getPetTotalStats(aPet);
  const vStats = getPetTotalStats(vPet);

  let aHp = aStats.hp * 5;
  let vHp = vStats.hp * 5;
  const aMaxHp = aHp, vMaxHp = vHp;

  let log = [];
  let turn = 0;
  let isA_Turn = aStats.spd >= vStats.spd; // Tốc độ cao đánh trước

  // Vòng lặp trận đấu (Tối đa 10 hiệp để tránh spam text)
  while(aHp > 0 && vHp > 0 && turn < 10) {
    turn++;
    let atkStats = isA_Turn ? aStats : vStats;
    let defStats = isA_Turn ? vStats : aStats;
    let atkPet = isA_Turn ? aPet : vPet;
    
    let skillName = "Đánh Thường";
    let damage = Math.max(1, atkStats.atk - defStats.def * 0.5);
    let heal = 0;
    let r = Math.random();
    const rank = atkPet.petKey === 'dark_dragon' && mode === 'tower' ? 'SSS' : PETS[atkPet.petKey]?.rank || 'B';

    // Check Custom Skills (35% chance to cast)
    let usedCustomSkill = false;
    if (atkPet.skills && atkPet.skills.length > 0 && r < 0.35) {
      const skillId = atkPet.skills[Math.floor(Math.random() * atkPet.skills.length)];
      const skillInfo = SKILL_BOOKS[skillId];
      if (skillInfo) {
        skillName = `${skillInfo.emoji} ${skillInfo.name}`;
        let effDef = skillInfo.ignoreDef ? defStats.def * 0.2 : defStats.def * 0.5;
        damage = Math.max(5, atkStats.atk * skillInfo.damageMult - effDef);
        heal = damage * (skillInfo.heal || 0);
        usedCustomSkill = true;
      }
    }

    if (!usedCustomSkill) {
      // Kỹ năng theo phẩm chất
      if (['S', 'SS', 'SSS'].includes(rank) && r < 0.20) {
          skillName = "✨ Tuyệt Kỹ Tối Thượng";
          damage = atkStats.atk * 2.5; // Bỏ qua giáp
          if (rank === 'SSS') heal = atkStats.hp * 0.5; // Hồi máu
      } else if (r < 0.40) {
          skillName = "💥 Đòn Đặc Trưng";
          damage = Math.max(5, atkStats.atk * 1.5 - defStats.def * 0.3);
      }
    }

    // Biến thiên sát thương +-10%
    damage = Math.floor(damage * (0.9 + Math.random() * 0.2));
    
    if (isA_Turn) vHp -= damage; else aHp -= damage;
    if (heal > 0) {
        if (isA_Turn) aHp = Math.min(aMaxHp, aHp + heal); else vHp = Math.min(vMaxHp, vHp + heal);
    }

    let actionLog = `**${atkPet.name}** tung *${skillName}* ➝ **-${damage} HP**`;
    if (heal > 0) actionLog += ` 💚(+${Math.floor(heal)} HP)`;
    log.push(actionLog);

    isA_Turn = !isA_Turn;
  }

  const isWin = aHp > vHp;
  let resultMsg = "";

  // Update PVP count
  if (mode === 'bet' || mode === 'force') {
     attackerUser.pvpCount += 1;
     await User.updateOne({ userId: attackerUser.userId, guildId: attackerUser.guildId }, { $set: { pvpCount: attackerUser.pvpCount, pvpTime: attackerUser.pvpTime }});
  }

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
     if (isWin) {
        const stolen = Math.floor(victimUser.coins * (0.01 + Math.random() * 0.04)); // Cướp 1-5%
        await User.updateOne({ userId: attackerUser.userId, guildId: attackerUser.guildId }, { $inc: { coins: stolen } });
        await User.updateOne({ userId: victimUser.userId, guildId: victimUser.guildId }, { $inc: { coins: -stolen } });
        resultMsg = `🏴‍☠️ Úp sọt thành công! Cướp được **${stolen.toLocaleString()} xu**!`;
     } else {
        const penalty = Math.floor(attackerUser.coins * 0.05); // Phạt 5%
        await User.updateOne({ userId: attackerUser.userId, guildId: attackerUser.guildId }, { $inc: { coins: -penalty } });
        await User.updateOne({ userId: victimUser.userId, guildId: victimUser.guildId }, { $inc: { coins: penalty } });
        resultMsg = `🚑 Bị phản đam! Phải đền bù thuốc men **${penalty.toLocaleString()} xu** cho nạn nhân!`;
     }
  }

  return { isWin, log, resultMsg, aPet, vPet, aHp: Math.max(0, aHp), vHp: Math.max(0, vHp), aMaxHp, vMaxHp };
};