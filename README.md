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

## ─── ❖ HƯỚNG DẪN DEPLOY TRÊN CLOUD ❖ ───

Để chạy dự án online hoàn toàn từ xa, bạn có thể triển khai Frontend trên **Vercel** và Backend trên **Render**.

### 1. Triển khai Frontend (Vercel)
1. Đăng nhập vào [Vercel](https://vercel.com/) và liên kết với tài khoản GitHub của bạn.
2. Nhấp **Add New** -> **Project** và chọn repository `BotMine` của bạn.
3. Vercel sẽ tự động phát hiện file `vercel.json` ở thư mục gốc để định tuyến toàn bộ request sang thư mục `frontend/`. 
4. Bạn không cần thay đổi bất kỳ cấu hình mặc định nào khác, chỉ cần nhấp **Deploy**.
5. Sau khi deploy thành công, bạn sẽ nhận được địa chỉ URL dạng `https://ten-du-an.vercel.app`.

> [!TIP]
> **Cấu hình nhanh API URL**: Bạn có thể mở giao diện panel qua liên kết kèm tham số truy vấn để tự động cấu hình và lưu địa chỉ Backend mà không cần nhập tay:
> `https://ten-du-an.vercel.app/?backend=https://backend-cua-ban.onrender.com`

### 2. Triển khai Backend (Render)
1. Đăng nhập vào [Render](https://render.com/) và nhấp **New** -> **Web Service**.
2. Chọn liên kết với repository `BotMine` từ GitHub.
3. Trong cài đặt cấu hình Web Service:
   - **Root Directory**: Nhập `backend`
   - **Runtime**: Chọn `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Cấu hình **Environment Variables (Biến môi trường)**:
   - `PORT`: (Mặc định Render tự cấp phát)
   - `FRONTEND_URL`: Nhập địa chỉ Vercel của bạn (ví dụ: `https://ten-du-an.vercel.app`) để mở cấu hình CORS bảo mật cao. Hoặc nhập `*` để chấp nhận mọi nguồn truy cập.
5. Nhấp **Deploy Web Service**. Render sẽ bắt đầu build và khởi chạy máy chủ backend.

---

<p align="center">
  <b>© 2026 Huy Phan. All rights reserved.</b><br>
  <sub>Sản phẩm được tối ưu hóa và phát triển bởi Huy Phan.</sub>
</p>
