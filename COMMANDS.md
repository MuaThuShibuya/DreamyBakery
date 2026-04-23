# 📱 TIỆM BÁNH MỘNG MƠ — TÀI LIỆU HỆ THỐNG GIAO DỊCH & GIẢI TRÍ

> **Phiên bản:** 2.0.0 (Enterprise & Super App)  
> **Kiến trúc:** Bảng điều khiển trung tâm (Dashboard) kết hợp Pop-up Menu (UI/UX Tối ưu).

---

## 🎯 1. BẢNG ĐIỀU KHIỂN TRUNG TÂM (SUPER APP)

Hệ thống đã được tự động hóa hoàn toàn. Người chơi **không cần phải nhớ từng lệnh riêng lẻ**. Mọi tính năng của game đều được tích hợp trong một lệnh duy nhất:

### `!menu` hoặc `/menu`

Khi gõ lệnh này, một **Bảng Điều Khiển** sẽ hiện ra với 5 khu vực chính:

| Khu Vực | Chức năng bao gồm |
|:---:|:---|
| 🌾 **Khu Sản Xuất** | Thu hoạch Vườn (`30p`), Thu hoạch Trại (`1h`), Nướng bánh, Quản lý Lò nướng. |
| 🏪 **Khu Thương Mại** | Giao đơn NPC lấy EXP, Bán bánh lấy xu, Đi chợ đen, Đăng bán lên Shop Độc Quyền. |
| 🎒 **Hồ Sơ & Kho** | Xem túi đồ, Nâng cấp Lò/Vườn, Xem Profile cá nhân. |
| ⚔️ **Xã Hội & PvP** | Tag người chơi khác để: **Trộm vườn**, **Đấu Pet**, **Chuyển tiền**. |
| 🐾 **Trại Thú Cưng** | Roll Gacha ấp trứng (2,000 xu), Cho Thú cưng ăn bánh để tiến hóa & tăng lực chiến. |

*(Tất cả tương tác bên trong `!menu` đều là **Ephemeral** - cửa sổ ẩn chỉ người bấm mới thấy, giúp kênh chat luôn gọn gàng, sạch sẽ).*

---

## 🐾 2. HỆ THỐNG THÚ CƯNG & PVP (MỚI)

Game tích hợp cơ chế nuôi thú ảo và quyết đấu (Tương tự Pokémon/Axie):

1. **Ấp trứng (Gacha):** Tốn `2,000 xu` để mở ra 1 trong 23 loại thú cưng ngẫu nhiên.
2. **Xếp hạng thú cưng:**
   * ⚪ **Hạng B** (Tỉ lệ 60%): Slime, Sâu Róm, Chuột...
   * 🟢 **Hạng A** (Tỉ lệ 25%): Sói, Mèo Rừng, Gấu Trúc...
   * 🔵 **Hạng S** (Tỉ lệ 10%): Hỏa Hồ Ly, Rồng Đất...
   * 🟣 **Hạng SS** (Tỉ lệ 4%): Phượng Hoàng, Kỳ Lân, Bạch Hổ...
   * 🟡 **Hạng SSS** (Tỉ lệ 1%): Hắc Long, Leviathan, Thiên Thần...
3. **Cường hóa:** Thú cưng cần "ăn" bánh nướng để tăng EXP. Bánh càng đắt tiền (Ví dụ: *Bánh Vàng Huyền Thoại*), thú cưng càng nhanh lên cấp và tăng mạnh các chỉ số Lực Chiến (HP, ATK, DEF, SPD).
4. **Khiêu chiến (PvP):** Vào tab **Xã Hội & PvP**, chọn đối thủ và bấm **Đấu Pet**. Hệ thống sẽ tự động so sánh Lực Chiến (BP) giữa 2 con Pet để phân thắng bại.

---

## 🏪 3. HỆ THỐNG THƯƠNG MẠI & TÍN DỤNG

| Nhóm | Lệnh tắt / Chức năng | Mô tả |
|:---|:---|:---|
| **Tín Dụng** | `!vay thongtin` | Xem dư nợ ngân hàng. |
| | `!vay tra <số_tiền>` | Thanh toán nợ ngân hàng. |
| | `!chuyentien @user <xu>`| Chuyển khoản xu cho người chơi khác (Có Menu UI). |
| **Độc Quyền**| `!shop` | Cửa hàng Thương mại do DEV quản lý. **Chỉ người được cấp giấy phép** mới có nút "Đăng Bán". Người chơi chỉ có thể mua. |
| **Thị trường**| `!market` | Nơi mua nguyên liệu hiếm (Chocolate, Vani, Bột Vàng) và bán các loại bánh đã nướng để thu hồi vốn. |

---

## 👑 4. HƯỚNG DẪN CẤP QUYỀN NHÀ PHÁT TRIỂN (DEV ONLY)

Hệ thống bảo mật mới **từ chối toàn bộ quyền Admin của Discord**. Chỉ duy nhất người có ID được khai báo trong file `.env` mới có thể sử dụng các lệnh hệ thống.

**Cách lấy ID tài khoản Discord của bạn:**
1. Mở Discord, vào **Cài đặt người dùng (User Settings)** (biểu tượng bánh răng).
2. Kéo xuống mục **Nâng cao (Advanced)**.
3. Bật công tắc **Chế độ nhà phát triển (Developer Mode)**.
4. Thoát cài đặt, nhắn một tin nhắn bất kỳ vào kênh chat.
5. **Chuột phải** vào ảnh đại diện của bạn -> Chọn **Sao chép ID Người dùng (Copy User ID)**.
6. Mở file `.env`, thêm dòng sau và dán ID của bạn vào:
   ```env
   DEV_ID=123456789012345678
   ```
7. Khởi động lại Bot. Từ giờ, chỉ bạn (hoặc người được bạn cấp quyền) mới có thể can thiệp vào nền kinh tế server.

### 💻 CÁC LỆNH HỆ THỐNG

| Lệnh | Mô tả |
|------|-------|
| `!admin setshop @user [true/false]` | Cấp giấy phép kinh doanh (quyền đăng bán trên `!shop`). |
| `!vay @user [số_tiền] [lãi_suất]` | Giải ngân (Cộng tiền vào ví user và tự sinh dư nợ lãi suất). |
| `!admin give @user [item] [so_luong]` | Tặng vật phẩm cho người chơi |
| `!admin coins @user [so_luong]` | Cộng/trừ xu (số âm = trừ) |
| `!admin exp @user [so_luong]` | Cộng EXP cho người chơi |
| `!admin resetcd @user [loai]` | Reset hồi chiêu (garden/farm/sneak/all) |
| `!admin reset @user true` | ⚠️ Xóa toàn bộ dữ liệu game của người chơi |
| `!admin stats` | Xem thống kê tổng hợp server |
| `!admin ban @user [ly_do]` | Cấm người chơi sử dụng bot |
| `!admin unban @user` | Bỏ cấm người chơi |
| `!admin broadcast [tieu_de] [noi_dung]` | Gửi thông báo embed vào channel |

> `!admin reset` **KHÔNG THỂ HOÀN TÁC** — cần xác nhận.

---

## 🚀 5. KHỞI CHẠY DỰ ÁN TẠI LOCAL

```bash
# Cài dependencies
npm install

# Tạo file .env từ template
cp .env.example .env
# Điền: DISCORD_TOKEN, MONGODB_URI, DEV_ID

# Đăng ký slash commands lên Discord (chạy 1 lần sau khi thêm/sửa lệnh)
node deploy-commands.js

# Chạy bot
npm start

# Dev mode (tự restart khi code thay đổi)
npm run dev
```

---

*Cập nhật lần cuối: 2026-04-23 | Bot version: 1.0.0*
