# 🎒 Quản Lý Hòm Đồ (Inventory Management)

Giao diện quản lý kho đồ hiển thị trực quan toàn bộ các vật phẩm bot đang sở hữu theo dạng lưới chuẩn của game Minecraft.

---

## 1. Giao Diện Lưới Vật Phẩm
Màn hình kho đồ được chia làm 2 cụm lưới chính:
*   **Kho đồ chính (Main Inventory)**: Lưới 3x9 ở phía trên hiển thị các vật phẩm cất trong balo.
*   **Thanh công cụ nhanh (Hotbar)**: Lưới 1x9 ở phía dưới hiển thị các vật phẩm có thể trang bị nhanh lên tay.

Mỗi vật phẩm được hiển thị kèm theo:
*   Tên vật phẩm chuẩn (ví dụ: `Diamond Sword`, `Iron Ore`).
*   Số lượng chồng vật phẩm (stack count) màu trắng ở góc dưới bên phải slot.

---

## 2. Vứt Bỏ Vật Phẩm (Drop Items)

> [!IMPORTANT]
> Để dọn dẹp kho đồ của bot từ xa:

1.  **Nhấp chuột** vào slot vật phẩm bất kỳ trong lưới kho đồ trên Web Panel.
2.  Một cửa sổ xác nhận nhỏ sẽ hiện ra hỏi bạn có muốn vứt vật phẩm này không.
3.  Nhấp **Xác nhận (Drop)**, giao diện sẽ gửi lệnh qua socket yêu cầu bot ném vật phẩm đó ra ngoài thế giới thực trong game ngay lập tức. Lưới kho đồ sẽ tự động tải lại trạng thái mới.

---

<p align="center">
  <b>© 2026 Huy Phan. All rights reserved.</b><br>
  <sub>Sản phẩm được tối ưu hóa và phát triển bởi Huy Phan.</sub>
</p>
