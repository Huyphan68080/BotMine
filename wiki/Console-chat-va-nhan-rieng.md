# 💬 Hệ Thống Console Chat & Nhắn Riêng

Bảng Console Chat được thiết kế với phong cách Cyberpunk để hiển thị nhật ký tin nhắn trực quan, hỗ trợ chia kênh và cảnh báo tin nhắn riêng.

---

## 1. Phân Loại 4 Kênh Chat (Tabs)

Bạn có thể nhấp chuột vào các nút tab ở phía trên cùng của ô chat để lọc nội dung hiển thị:

*   🌐 **TẤT CẢ**: Hiển thị toàn bộ tin nhắn nhận được từ server (bao gồm chat công khai, nhắn riêng và hệ thống).
*   💬 **KÊNH CHUNG**: Chỉ hiển thị các tin nhắn trò chuyện công khai của người chơi khác và của bot.
*   💗 **NHẮN RIÊNG**: Chỉ hiển thị các tin nhắn riêng (Whisper/PM/Direct Message) giữa bot và người chơi khác.
*   ⚙️ **HỆ THỐNG**: Hiển thị các thông báo từ server, log đăng nhập, bossbar, và thông điệp hành động.

---

## 2. Nhận Diện & Định Dạng Tin Nhắn Riêng (Whisper)

> [!NOTE]
> Khi có một tin nhắn riêng gửi tới bot (ví dụ: `Huyphan whispers to you: hello` hoặc `[Huyphan -> Tôi] hello`):

1.  **Thông báo nhấp nháy (Unread Badge)**: Nếu bạn đang ở các tab khác (Kênh chung, Hệ thống), nút tab **NHẮN RIÊNG** sẽ hiển thị một huy hiệu màu hồng chứa số lượng tin nhắn chưa đọc nhấp nháy liên tục để cảnh báo. Huy hiệu này sẽ tự biến mất khi bạn click vào tab Nhắn riêng.
2.  **Định dạng cao cấp**: Tin nhắn riêng được vẽ với màu hồng neon nổi bật, bao quanh bởi viền hồng và ghi rõ nguồn gửi-nhận: `[Nhắn riêng: Huyphan -> Tôi] hello`.

---

## 3. Popup Bản Đồ Captcha (Map Captcha)
*   Khi server game gửi một gói dữ liệu bản đồ captcha hình ảnh, giao diện sẽ kích hoạt hiển thị lớp phủ popup chứa ảnh captcha trực tiếp trên màn hình chat.
*   Hệ thống sẽ in một log thông báo màu tím trong tab Hệ thống yêu cầu bạn đọc mã và gửi phản hồi. Bạn có thể nhấn nút **Đóng (X)** trên popup để ẩn ảnh bản đồ đi sau khi đã giải xong.

---

<p align="center">
  <b>© 2026 Huy Phan. All rights reserved.</b><br>
  <sub>Sản phẩm được tối ưu hóa và phát triển bởi Huy Phan.</sub>
</p>
