# 📖 CẨM NANG & PHÂN QUYỀN TIỆM BÁNH MỘNG MƠ

Chào mừng bạn đến với **Tiệm Bánh Mộng Mơ (Dreamy Bakery)**! Trò chơi được chia làm 3 vai trò chính với các lối chơi kinh tế khác biệt. Dưới đây là tổng hợp chức năng và hướng dẫn chi tiết cho từng vai trò.

> 💡 **SIÊU MẸO:** Mọi tính năng trong game đều có thể truy cập qua một lệnh duy nhất là `.menu` (hoặc `/menu`). Bạn chỉ cần mở Bảng Điều Khiển lên và thao tác bằng các nút bấm thả xuống cực kỳ tiện lợi!

---

## 🌱 1. VAI TRÒ: NÔNG DÂN (USER CƠ BẢN)
**Ai sở hữu:** Tất cả người chơi mới tham gia.
**Mục tiêu:** Sản xuất nguyên liệu thô, tích lũy tài sản, giao lưu xã hội và nuôi thú cưng.

### 📌 Các tính năng chính:
- **Khu Sinh Thái:** 
  - 🌿 Thu hoạch Vườn (`30 phút`): Lấy Lúa Mì, Dâu Tây, Hoa Hồng.
  - 🏡 Thu hoạch Trại (`1 giờ`): Lấy Sữa, Trứng, Bơ.
- **Thương Mại & Ngân hàng:**
  - 🏪 Chợ NPC: Bán nguyên liệu thô lấy xu.
  - 🏬 Shop Người Chơi: Mua các loại bánh thơm ngon do Chủ Shop làm ra.
  - 💳 Ngân Hàng: Xem thông tin vay nợ, trả nợ, hoặc chuyển khoản cho bạn bè.
- **Xã Hội & Giải Trí:**
  - 🐾 Trại Thú Cưng: Dùng `2,000 xu` để ấp trứng (Gacha).
  - 🎁 Tặng Quà: Tặng nguyên liệu hoặc bánh cho người khác.
  - 🐾 Trộm Vườn: Lẻn sang nhà bạn bè để trộm nguyên liệu (cẩn thận bị chó cắn mất đồ!).
  - ⚔️ PvP: Chọi bánh vào mặt nhau để cướp xu, hoặc đem Thú Cưng ra đấu Lực Chiến (BP).
- **Nâng Cấp:** Nâng cấp Vườn và Trang trại để tăng sản lượng thu hoạch.

### 🎮 Hướng dẫn cách chơi (Lộ trình Nông Dân):
1. **Giai đoạn 1 (Chăm chỉ):** Cứ mỗi 30p - 1h, gõ `.menu` -> chọn **Khu Sinh Thái** để thu hoạch.
2. **Giai đoạn 2 (Kiếm tiền):** Vào **Khu Thương Mại** -> **Chợ NPC**, bán bớt nguyên liệu để lấy Xu.
3. **Giai đoạn 3 (Đầu tư):** Dùng xu để ấp trứng tìm Thú Cưng xịn (Hạng SSS). Mua bánh từ các *Chủ Shop* trên chợ để cho Thú Cưng ăn, giúp nó lên cấp và vô đối trong Đấu Pet!
4. **Giai đoạn 4 (Thăng tiến):** Khi đã quen thuộc, hãy xin Admin server cấp cho bạn "Giấy phép kinh doanh" để thăng cấp lên làm **Chủ Shop**!

---

## 🏬 2. VAI TRÒ: CHỦ SHOP (SHOP OWNER)
**Ai sở hữu:** Những người chơi được Admin tin tưởng và cấp phép bằng lệnh `.admin setshop`.
**Mục tiêu:** Nướng bánh, phục vụ khách NPC, điều tiết thị trường mua bán với người chơi khác.

### 📌 Các tính năng ĐỘC QUYỀN (Cộng thêm các tính năng của Nông Dân):
- **Khu Vực Kinh Doanh:**
  - 🍳 Lò Nướng (`.bake`): Kết hợp nguyên liệu để tạo ra bánh. Có tỷ lệ ra bánh **✨ Thượng Hạng** giá trị cực cao.
  - � Quản lý Lò (`.oven`): Thu thập bánh sau khi nướng xong.
  - � Sổ Tay: Xem công thức của 8 loại bánh khác nhau.
  - � Đơn Hàng NPC (`.order`): Giao bánh theo yêu cầu của các nhân vật ảo mỗi ngày để lấy rất nhiều Xu và EXP.
  - � Đăng Bán Hàng: Được quyền **đăng bán** bánh lên Shop Người Chơi với mức giá tự quyết định!
- **Nâng Cấp Đặc Biệt:** Có quyền nâng cấp *Lò Nướng* (giảm thời gian chờ) và *Trang Trí Tiệm* (tăng số lượng đơn NPC mỗi ngày).

### 🎮 Hướng dẫn cách chơi (Lộ trình Chủ Shop):
1. Mua thêm nguyên liệu hiếm (*Chocolate, Vani, Bột Vàng*) từ **Chợ NPC**.
2. Vào **Khu Kinh Doanh** -> **Nướng Bánh**. Chọn nướng số lượng tối đa để tăng tỷ lệ ra bánh ✨Thượng Hạng.
3. Mỗi ngày, kiểm tra **Đơn Hàng NPC**. Nướng bánh đúng yêu cầu và giao cho NPC để cày Cấp Độ (EXP) cực nhanh.
4. Số bánh thừa hoặc bánh Thượng Hạng, hãy **Đăng Bán** lên Shop Người Chơi. Các Nông Dân sẽ mua bánh của bạn để cho Thú Cưng của họ ăn!

---

## 👑 3. VAI TRÒ: NHÀ PHÁT TRIỂN (DEV / ADMIN)
**Ai sở hữu:** Bạn - Người có Discord ID được cài đặt trong mã nguồn (`.env`). Quyền lực tối cao, bỏ qua mọi giới hạn của bot.
**Mục tiêu:** Quản trị server, tổ chức sự kiện, kiểm soát lạm phát và hỗ trợ người chơi.

### 📌 Các tính năng ĐỘC QUYỀN:
- **Bảng Điều Khiển Dev (Dev Panel trên `.menu`):**
  - 🎁 **Tặng Đồ:** Bơm bất kỳ vật phẩm/bánh nào cho bất kỳ ai.
  - 💰 **Chỉnh Xu & EXP:** Cộng hoặc trừ tiền/cấp độ của người chơi.
  - 🏬 **Cấp Shop:** Trao hoặc tước "Giấy phép kinh doanh" (Quyền Chủ Shop) của người chơi.
  - 🔨 **Ban / Unban:** Cấm người chơi phá hoại khỏi hệ thống bot.
  - 🔄 **Reset Hồi Chiêu:** Hỗ trợ người chơi xóa thời gian chờ thu hoạch/trộm cắp.
  - 📊 **Thống Kê:** Xem tổng số xu lưu thông, người giàu nhất, số bánh đã nướng của cả server.
  - 📢 **Broadcast:** Gửi thông báo Event dạng Embed đẹp mắt vào kênh chat.
  - ⚠️ **Xóa Dữ Liệu:** Reset hoàn toàn một tài khoản về số 0.

- **Hệ Thống Tín Dụng & Tiền Tệ (Gõ lệnh ngoài):**
  - `.bomtien <số lượng>`: Tự động bơm lượng lớn xu vào túi mình.
  - `.bomtien capquyen @user`: Cho phép bạn bè hoặc đệ tử của bạn cũng có quyền tự bơm tiền.
  - `.vay cap @user <số_tiền> <lãi_suất>`: Đóng vai trò là Ngân Hàng, giải ngân cho người chơi vay tiền và tự động tính dư nợ.
  - `.admin setchannel add #kênh`: Khóa bot lại, bắt bot chỉ được trả lời ở kênh quy định (chống spam box chat chung).

### 🎮 Hướng dẫn sử dụng cho Dev:
- Hãy dùng **Dev Panel** trong `.menu` để tương tác trực quan (Bot sẽ hiện Form để bạn điền ID, Số lượng, Lý do...).
- Khi muốn tổ chức Event đua top, bạn có thể dùng `.admin resetcd` để reset hồi chiêu cho mọi người, hoặc `.admin give` để phát phần thưởng độc quyền.
- Nếu một người chơi muốn làm Chủ Shop, hãy ra điều kiện (VD: đạt Cấp 10 và đóng phí 50,000 xu). Sau đó thu xu của họ bằng `.admin coins @user -50000` và cấp quyền bằng `.admin setshop @user true`.

---

### ❓ CÁC CÂU HỎI THƯỜNG GẶP (FAQ)
**1. Tại sao tôi không thấy nút Nướng Bánh?**
> Vì bạn đang là "Nông Dân" (User cơ bản). Hãy chăm chỉ cày nguyên liệu bán lấy tiền, hoặc xin Dev cấp quyền Chủ Shop nhé!

**2. Bánh Thượng Hạng (Shiny) dùng để làm gì?**
> Bánh Thượng Hạng có giá trị cao gấp 3 lần bánh thường. Nếu dùng để cho Thú Cưng ăn, Thú Cưng cũng sẽ nhận được lượng EXP khổng lồ!

**3. Làm sao để Thú Cưng của tôi mạnh lên nhanh nhất?**
> Hãy ấp ra một bé thú cưng Hạng cao (S, SS hoặc SSS) vì chúng có chỉ số cộng thêm mỗi cấp rất cao. Sau đó mua những loại bánh đắt tiền (VD: *Bánh Vàng Huyền Thoại*) cho chúng ăn để tăng cấp vù vù.

**4. Tôi đang vay tiền ngân hàng, làm sao để trả?**
> Mở `.menu` -> **🛒 Thương Mại** -> **💳 Ngân Hàng** -> Bấm nút **Thanh Toán Nợ**. Hoặc gõ nhanh lệnh `.vay tra <số_tiền>`.