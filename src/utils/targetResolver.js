'use strict';

/**
 * Phân tích input của người dùng (ID, @mention, hoặc link URL) thành User ID.
 * @param {string} input 
 * @returns {string|null} User ID hoặc null nếu không hợp lệ
 */
function resolveUserId(input) {
  if (!input) return null;
  input = input.trim();

  // 1. Nếu là ID thuần (17-19 số)
  if (/^\d{17,19}$/.test(input)) {
    return input;
  }

  // 2. Nếu là @mention (<@123456789> hoặc <@!123456789>)
  const mentionMatch = input.match(/^<@!?(\d+)>$/);
  if (mentionMatch) return mentionMatch[1];

  // 3. Nếu là link Discord (discord.com/users/123456789)
  const urlMatch = input.match(/discord\.com\/users\/(\d+)/);
  if (urlMatch) return urlMatch[1];

  return null;
}

module.exports = { resolveUserId };