# ❖ Cyberpunk BotMine Client ❖

<p align="center">
  <img src="https://img.shields.io/badge/BotMine_Client-v2.1-purple?style=for-the-badge&logo=minecraft&logoColor=white" />
  <img src="https://img.shields.io/badge/Aesthetic-Cyberpunk_Neon-ff69b4?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Developer-Huy_Phan-blueviolet?style=for-the-badge" />
</p>

Chào mừng bạn đến với **BotMine Client** – Hệ thống quản lý Minecraft Bot thế hệ mới với giao diện web Cyberpunk (Onion / Salarixi theme) cực kỳ cao cấp, hỗ trợ luồng Camera 3D thời gian thực và tự động giải quyết Captcha/AuthMe thông minh.

> [!NOTE]
> Để xem hướng dẫn đầy đủ về tất cả các tính năng, phím tắt điều khiển và cấu hình nâng cao, vui lòng truy cập **[GitHub Wiki của dự án](https://github.com/Huyphan68080/BotMine/wiki)**.

---

## ─── ❖ CẤU TRÚC THƯ MỤC DỰ ÁN ❖ ───

Dưới đây là cấu trúc thư mục chính của dự án:

```
BotMine/
├── backend/            # Server điều khiển bot và stream camera (Node.js)
│   ├── server.js       # Máy chủ Socket.io & xử lý luồng kết nối Mineflayer
│   ├── package.json    # Khai báo các thư viện phụ thuộc (Mineflayer, Socket.io)
│   └── package-lock.json
│
├── frontend/           # Giao diện Web Control Panel (HTML/CSS/JS)
│   ├── index.html      # Trang chủ giao diện (Cyberpunk UI)
│   ├── app.js          # Xử lý sự kiện bàn phím, kết nối Socket client & vẽ DOM
│   └── style.css       # File thiết kế CSS với hệ màu Salarixi (Tím - Hồng Neon)
│
├── wiki/               # Thư mục chứa tài liệu hướng dẫn Wiki (bản offline)
│   ├── Home.md         # Trang chủ tài liệu Wiki
│   └── Huong-dan-chi-tiet.md # Hướng dẫn phím tắt & cơ chế bảo mật
│
└── README.md           # Hướng dẫn cài đặt và cấu trúc thư mục dự án
```

---

## ─── ❖ HƯỚNG DẪN CÀI ĐẶT & CHẠY ❖ ───

### 1. Yêu Cầu Hệ Thống
*   Đã cài đặt **Node.js** (Phiên bản khuyến nghị: từ v18 trở lên).
*   Trình duyệt hỗ trợ WebGL (Chrome, Edge, Firefox, Brave).

### 2. Cài Đặt Thư Viện (Dependencies)
Mở terminal/dòng lệnh tại thư mục `backend/` và chạy lệnh sau:
```bash
cd backend
npm install
```

### 3. Khởi Động Server
Khởi chạy backend server để lắng nghe điều khiển và bắt đầu kết nối bot Minecraft:
```bash
node server.js
```
*   **Backend Server Port**: `3000` (Socket.io)
*   **Camera 3D Stream Port**: `3001` (Prismarine Viewer)

### 4. Mở Giao Diện Web
Mở trực tiếp file `frontend/index.html` trong trình duyệt web của bạn để bắt đầu sử dụng.

---

<p align="center">
  <b>© 2026 Huy Phan. All rights reserved.</b><br>
  <sub>Sản phẩm được tối ưu hóa và phát triển bởi Huy Phan.</sub>
</p>
