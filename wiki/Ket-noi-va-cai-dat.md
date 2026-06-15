# 🌐 Kết Nối & Cài Đặt Dự Án

Trang này hướng dẫn bạn cách cài đặt các thư viện phụ thuộc, khởi chạy máy chủ backend và kết nối bot vào các server Minecraft.

---

## 1. Yêu Cầu Hệ Thống
*   **Node.js**: Phiên bản khuyến nghị từ v18 trở lên.
*   **Minecraft Server**: Hỗ trợ hầu hết các phiên bản (tự động nhận diện giao thức).
*   **Trình duyệt**: Hỗ trợ WebGL để hiển thị Camera 3D.

## 2. Khởi Chạy Hệ Thống

### Bước 1: Cài đặt Dependencies
Mở terminal/dòng lệnh tại thư mục `backend/` và chạy:
```bash
cd backend
npm install
```

### Bước 2: Chạy Server
Khởi chạy backend server điều khiển:
```bash
node server.js
```
*   **Cổng Backend (Websocket)**: `3000`
*   **Cổng Camera 3D Stream**: `3001`

### Bước 3: Truy cập giao diện
Mở trực tiếp file `frontend/index.html` bằng trình duyệt web.

---

## 3. Cấu Hình Kết Nối Trên Giao Diện

Khi mở Web Panel, bạn sẽ thấy khung **KẾT NỐI BOT** với các tham số:

| Tham số | Ý nghĩa | Lưu ý |
| :--- | :--- | :--- |
| **IP Máy chủ** | Địa chỉ IP của server Minecraft. | Ví dụ: `soravn.xyz` |
| **Cổng (Port)** | Cổng kết nối TCP của máy chủ. | Mặc định: `25565` |
| **Tên người dùng** | Tên nhân vật của bot trong game. | Độ dài từ 3-16 ký tự. |
| **Mật khẩu** | Mật khẩu dùng cho hệ thống AuthMe. | Để trống nếu server không yêu cầu. |
| **Cơ chế xác thực** | Chọn kiểu tài khoản kết nối. | `Offline` (Cracked) hoặc `Microsoft` (Premium). |
| **Tự động kết nối lại** | Tự động kết nối khi bị kick. | Sẽ đợi một khoảng cooldown để tránh bị chặn IP. |

---

<p align="center">
  <b>© 2026 Huy Phan. All rights reserved.</b><br>
  <sub>Sản phẩm được tối ưu hóa và phát triển bởi Huy Phan.</sub>
</p>
