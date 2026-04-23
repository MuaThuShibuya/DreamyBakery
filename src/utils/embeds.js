'use strict';
/**
 * @file embeds.js
 * @description Các helper builder cho Discord Embeds, Buttons và SelectMenus.
 *
 * Triết lý thiết kế:
 *  - Mọi embed dùng footer thống nhất "🍰 Tiệm Bánh Mộng Mơ"
 *  - Màu sắc theo trạng thái (thành công = xanh, lỗi = đỏ, v.v.)
 *  - Hàm btn() nhận style dạng string để code dễ đọc hơn
 */

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
} = require('discord.js');
const { COLORS } = require('./constants');

// ─── Embed Builders ───────────────────────────────────────────────────────────

/**
 * Tạo embed chuẩn của Tiệm Bánh Mộng Mơ với footer và timestamp.
 * @param {string} title       - Tiêu đề embed
 * @param {string} description - Nội dung chính
 * @param {number} [color]     - Mã màu hex, mặc định primary
 * @returns {EmbedBuilder}
 */
function bakeryEmbed(title, description, color = COLORS.primary) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: '🍰 Tiệm Bánh Mộng Mơ  •  Dreamy Bakery' })
    .setTimestamp();
}

/**
 * Embed thông báo lỗi (màu đỏ nhẹ).
 * @param {string} desc - Mô tả lỗi
 */
function errorEmbed(desc) {
  return bakeryEmbed('❌ Ôi không!', desc, COLORS.error);
}

/**
 * Embed thông báo thành công (màu xanh bạc hà).
 * @param {string} title - Tiêu đề
 * @param {string} desc  - Nội dung
 */
function successEmbed(title, desc) {
  return bakeryEmbed(title, desc, COLORS.success);
}

/**
 * Embed cảnh báo (màu vàng kem).
 * @param {string} title - Tiêu đề
 * @param {string} desc  - Nội dung
 */
function warningEmbed(title, desc) {
  return bakeryEmbed(title, desc, COLORS.warning);
}

// ─── Button Builder ───────────────────────────────────────────────────────────

/** Map string style → ButtonStyle enum để code dễ đọc hơn */
const STYLE_MAP = {
  Primary:   ButtonStyle.Primary,
  Secondary: ButtonStyle.Secondary,
  Success:   ButtonStyle.Success,
  Danger:    ButtonStyle.Danger,
};

/**
 * Tạo ButtonBuilder với style dạng string.
 * @param {string}  customId - ID định danh button
 * @param {string}  label    - Nhãn hiển thị
 * @param {string}  [style]  - 'Primary' | 'Secondary' | 'Success' | 'Danger'
 * @param {boolean} [disabled] - Vô hiệu hóa button
 * @returns {ButtonBuilder}
 */
function btn(customId, label, style = 'Primary', disabled = false) {
  return new ButtonBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(STYLE_MAP[style] ?? ButtonStyle.Primary)
    .setDisabled(disabled);
}

// ─── ActionRow Builder ────────────────────────────────────────────────────────

/**
 * Tạo ActionRowBuilder từ danh sách component.
 * @param {...ButtonBuilder|StringSelectMenuBuilder} components
 * @returns {ActionRowBuilder}
 */
function row(...components) {
  return new ActionRowBuilder().addComponents(...components);
}

// ─── Select Menu Builder ──────────────────────────────────────────────────────

/**
 * Tạo StringSelectMenuBuilder.
 * @param {string} customId   - ID định danh menu
 * @param {string} placeholder - Placeholder text
 * @param {Array}  options    - Mảng { label, description, value }
 * @param {number} [min]      - Số lựa chọn tối thiểu
 * @param {number} [max]      - Số lựa chọn tối đa
 * @returns {StringSelectMenuBuilder}
 */
function selectMenu(customId, placeholder, options, min = 1, max = 1) {
  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .setMinValues(min)
    .setMaxValues(max)
    .addOptions(options);
}

/**
 * Tạo UserSelectMenuBuilder (Menu chọn người chơi).
 * @param {string} customId   - ID định danh
 * @param {string} placeholder - Placeholder text
 * @returns {UserSelectMenuBuilder}
 */
function userSelectMenu(customId, placeholder) {
  return new UserSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder);
}

module.exports = { bakeryEmbed, errorEmbed, successEmbed, warningEmbed, btn, row, selectMenu, userSelectMenu };
