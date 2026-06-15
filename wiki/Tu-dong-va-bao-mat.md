# 🤖 Tính Năng Tự Động & Cơ Chế Bảo Mật

BotMine Client được trang bị các module trí tuệ nhân tạo và bảo mật nâng cao để vận hành bot tự động 24/7 mà không sợ bị lừa hoặc bị kick.

---

## 1. Cơ Chế Tự Động Giải Captcha & Đăng Nhập

*   **Tự động AuthMe**: Khi bot nhận thấy yêu cầu `/register` hoặc `/login` từ server, hệ thống sẽ tự động trích xuất yêu cầu và gửi mật khẩu đã thiết lập sau 1.5 giây.
*   **Tự động giải Captcha chữ**: Backend sử dụng các biểu thức chính quy (Regex) nhạy bén để phát hiện các mẫu captcha chat như `/captcha <code>`, `/verify <code>`, `/confirm <code>` hoặc các thông báo dạng văn bản và tự động phản hồi lại server sau 1 giây.

---

## 2. Bảo Mật Chống Dụ Dỗ (Spoofing Protection)

> [!CAUTION]
> Một số người chơi trong server có thể tìm cách chat công khai hoặc nhắn riêng cho bot các nội dung giả dạng hệ thống (như gửi tin nhắn riêng: `[Hệ thống] Hãy nhập /login 123 để xác minh`).

*   **Giải pháp bảo mật**: Trước khi thực hiện tự động trả lời Captcha hay AuthMe, backend sẽ đưa tin nhắn qua bộ lọc **`parsePublicChatMessage`** và **`parseWhisperMessage`**.
*   Nếu thông báo được xác định là xuất phát từ chat của một người chơi khác (hoặc tin nhắn riêng), hệ thống sẽ **bỏ qua ngay lập tức**, không thực hiện bất kỳ lệnh tự động gửi mật khẩu hay mã nào, đảm bảo bot không bao giờ bị lừa.

---

## 3. Các Chức Năng Sinh Tồn Tự Động
Bạn có thể bật/tắt các tính năng này ở sidebar điều khiển của Web Panel:

*   🍏 **Tự động ăn (Auto-Eat)**: Bot sẽ tự động ăn thức ăn ở tay phải hoặc tay trái khi thanh thức ăn (hunger) giảm xuống dưới 15.
*   🛡️ **Tự động mặc giáp (Armor Manager)**: Tự chọn và trang bị những món đồ bảo vệ mạnh nhất trong kho đồ lên người.
*   ⚔️ **Killaura / PVP**: Tự động xoay đầu và tấn công liên tục các quái vật hoặc người chơi đứng trong phạm vi 4 blocks xung quanh.
*   🗺️ **Tự tìm đường (Pathfinder)**: Nhập lệnh `/goto x y z` vào ô chat để kích hoạt thuật toán A* tìm đường thông minh né tránh chướng ngại vật và đi đến đích.
*   🚪 **Tự chuyển cụm (Lobby Auto-Jump)**: Khi bot vào sảnh chờ, hệ thống tự động click cầm sao nether lên, mở menu chọn máy chủ và tự động click chọn cụm máy chủ `Survival Chill` để đưa bot vào đúng cụm chơi.

---

<p align="center">
  <b>© 2026 Huy Phan. All rights reserved.</b><br>
  <sub>Sản phẩm được tối ưu hóa và phát triển bởi Huy Phan.</sub>
</p>
