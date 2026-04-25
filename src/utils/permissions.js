'use strict';

/**
 * Quản lý vai trò và phân quyền trong server.
 */

const ROLE = {
  DEV: 'DEV',
  SHOP: 'SHOP',
  USER: 'USER'
};

// ID Discord của bạn (Dev tối cao)
const DEV_ID = process.env.DEV_ID || '1053382061018320987';

/** Kiểm tra người dùng có phải là Dev không */
function isDev(userId) {
  return userId === DEV_ID;
}

/** Kiểm tra người dùng có từ quyền Shop trở lên không */
function isShopOrAbove(userId, userDoc) {
  if (isDev(userId)) return true;
  return userDoc?.isShopOwner === true;
}

/** Lấy định danh Role của người dùng */
function getRole(userId, userDoc) {
  if (isDev(userId)) return ROLE.DEV;
  if (userDoc?.isShopOwner) return ROLE.SHOP;
  return ROLE.USER;
}

module.exports = {
  ROLE,
  isDev,
  isShopOrAbove,
  getRole
};