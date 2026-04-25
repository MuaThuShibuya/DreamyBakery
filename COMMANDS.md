# 🍰 TIỆM BÁNH MỘNG MƠ — TÀI LIỆU THIẾT KẾ & TỔNG QUAN HỆ THỐNG (GDD)

> **Phiên bản:** 3.0.0 (Enterprise Super App)  
> **Kiến trúc:** Bảng điều khiển trung tâm (Dashboard) kết hợp Pop-up Menu (UI/UX Tối ưu).
> **Engine DB:** MongoDB (NoSQL) với cấu trúc Document nguyên tử ($inc chống Race Condition).

---

## 🎯 1. KIẾN TRÚC GIAO DIỆN (SUPER APP)

Hệ thống nói **KHÔNG** với rác box chat. Mọi thao tác được thực hiện Real-time bằng `interaction.update()` thông qua một "Bảng điều khiển 1 chạm". Người chơi chỉ cần gõ:

### `.menu` hoặc `/menu`

Menu điều hướng sử dụng **Danh Sách Thả Xuống (Dropdown)** chia làm 6 phân khu:

| Phân Khu | Chức năng bao gồm |
|:---:|:---|
| 🏠 **Trang Chủ** | Xem số dư, cấp độ, Nhận **Điểm danh Hàng Ngày (.daily)**. |
| 👤 **Hồ Sơ & Kho** | Xem Profile, Mở túi đồ, Nâng cấp nhà, **Ăn bánh hồi HP (.eat)**. |
| 🌾 **Khu Sản Xuất** | Thu hoạch Vườn (`30p`), Thu hoạch Trại (`1h`), Nướng bánh, Quản lý Lò nướng. |
| 🏪 **Khu Thương Mại** | Giao đơn NPC lấy EXP, Bán bánh lấy xu, Đi chợ đen, Đăng bán lên Shop Độc Quyền. |
|  **Xã Hội & PvP** | Tag người chơi khác để: **Trộm vườn**, **Thách Đấu Cược Xu**, **Úp Sọt (Cướp)**, **Chuyển tiền**, **Tặng quà**. |
| 🏬 **Khu Kinh Doanh** | *(Chỉ Chủ Shop)* Nướng bánh, kiểm tra lò, Giao đơn NPC, Quản lý đăng bán hàng. |
| 🔧 **Dev Panel** | *(Chỉ Admin)* Bảng điều khiển tối cao quản trị nền kinh tế server. |

*(Tất cả tương tác bên trong `.menu` đều là **Ephemeral** - cửa sổ ẩn chỉ người bấm mới thấy, giúp kênh chat luôn gọn gàng, sạch sẽ).*

---

## 🐾 2. HỆ THỐNG GACHA, THÚ CƯNG & PVP TURN-BASED

Game tích hợp cơ chế nuôi thú ảo và quyết đấu (Tương tự Pokémon/Axie):

1. **Ấp trứng (Gacha):** Tốn `2,000 xu` để ấp x1 hoặc `20,000 xu` để ấp x10. Mở ra 23 loại thú cưng (Rank B -> SSS).
2. **Xếp hạng thú cưng:**
   * ⚪ **Hạng B** (Tỉ lệ 60%): Slime, Sâu Róm, Chuột...
   * 🟢 **Hạng A** (Tỉ lệ 25%): Sói, Mèo Rừng, Gấu Trúc...
   * 🔵 **Hạng S** (Tỉ lệ 10%): Hỏa Hồ Ly, Rồng Đất...
   * 🟣 **Hạng SS** (Tỉ lệ 4%): Phượng Hoàng, Kỳ Lân, Bạch Hổ...
   * 🟡 **Hạng SSS** (Tỉ lệ 1%): Hắc Long, Leviathan, Thiên Thần...
3. **Cường hóa & Đột Phá:** Cho thú cưng "ăn" bánh nướng để tăng EXP. Đặc biệt, nếu ăn bánh ✨ **Thượng Hạng (Shiny)**, thú cưng sẽ được **Tăng Sao (🌟)**, nhận một lượng Buff chỉ số khổng lồ.
4. **Hệ thống PvP Theo Lượt (Turn-based):**
   * **Cược Xu:** Sòng phẳng, cả 2 phải có tiền. Người thắng ăn tất cả tiền cược.
   * **Úp Sọt:** Lùa pet qua nhà người khác đập phá. Thắng sẽ cướp được tiền (1-5%), Thua sẽ bị phạt tiền bồi thường (5%). Có hồi chiêu 1 tiếng.
   * **Kỹ năng Tự Động:** Trong trận, Pet hạng cao sẽ có tỷ lệ tung "Tuyệt Kỹ Tối Thượng" (X2.5 Sát thương hoặc Hồi máu).

---

## 🏪 3. NỀN KINH TẾ (THƯƠNG MẠI, NƯỚNG BÁNH & NGÂN HÀNG)

Hệ thống Nướng Bánh được phân tầng rõ rệt:
- **Bánh Thường (Basic):** Nướng ngay lập tức (Instant), không tốn thời gian.
- **Bánh Cao Cấp/Thượng Hạng:** Có tỷ lệ ra ngẫu nhiên. Cần bỏ vào Lò Nướng chờ từ 5-30 phút (Thời gian giảm nếu nâng cấp Lò).

| Nhóm | Lệnh tắt / Chức năng | Mô tả |
|:---|:---|:---|
| **Tín Dụng** | `.vay thongtin` | Xem dư nợ ngân hàng. |
| | `.vay tra <số_tiền>` | Thanh toán nợ ngân hàng. |
| | `.chuyentien @user <xu>`| Chuyển khoản xu cho người chơi khác (Có Menu UI). |
| **Độc Quyền**| `.shop` | Cửa hàng Thương mại do DEV quản lý. **Chỉ người được cấp giấy phép** mới có nút "Đăng Bán". Người chơi chỉ có thể mua. |
| **Thị trường**| `.market` | Nơi mua nguyên liệu hiếm (Chocolate, Vani, Bột Vàng) và bán các loại bánh đã nướng để thu hồi vốn. |

---

## 👑 4. HƯỚNG DẪN CẤP QUYỀN NHÀ PHÁT TRIỂN (DEV ONLY)

Hệ thống bảo mật **từ chối toàn bộ quyền Admin của Discord**. Chỉ duy nhất người có ID được khai báo trong file `.env` (Biến `DEV_ID`) mới có thể mở Dev Panel trên `.menu` hoặc gõ lệnh.

### 💻 CÁC LỆNH ADMIN / DEV (CÓ THỂ DÙNG QUA DEV PANEL BẰNG UI)

| Lệnh | Mô tả |
|------|-------|
| `.admin setshop @user [true/false]` | Cấp giấy phép kinh doanh (quyền đăng bán trên `.shop`). |
| `.admin setchannel [add/remove] #kenh` | Chặn spam bằng cách chỉ cho bot hoạt động ở kênh chỉ định. |
| `.vay @user [số_tiền] [lãi_suất]` | Giải ngân (Cộng tiền vào ví user và tự sinh dư nợ lãi suất). |
| `.bomtien [số_lượng]` | Tự động bơm lượng lớn xu (Chỉ người được cấp quyền canSpawnCoins). |
| `.admin give @user [item] [so_luong]` | Tặng vật phẩm cho người chơi |
| `.admin coins @user [so_luong]` | Cộng/trừ xu (số âm = trừ) |
| `.admin exp @user [so_luong]` | Cộng EXP cho người chơi |
| `.admin resetcd @user [loai]` | Reset hồi chiêu (garden/farm/sneak/all) |
| `.admin reset @user true` | ⚠️ Xóa toàn bộ dữ liệu game của người chơi |
| `.admin stats` | Xem thống kê tổng hợp server |
| `.admin ban @user [ly_do]` | Cấm người chơi sử dụng bot |
| `.admin unban @user` | Bỏ cấm người chơi |
| `.admin broadcast [tieu_de] [noi_dung]` | Gửi thông báo embed vào channel |

> `.admin reset` **KHÔNG THỂ HOÀN TÁC** — cần xác nhận.

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
