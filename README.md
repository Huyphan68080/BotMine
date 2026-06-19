# ❖ BotMine Client ❖

<p align="center">
  <img src="https://img.shields.io/badge/BotMine_Client-v1.1.6-purple?style=for-the-badge&logo=minecraft&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-v18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Giao_diện-Cyberpunk_UI-ff69b4?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Developer-Huy_Phan-blueviolet?style=for-the-badge" />
</p>

<p align="center">
  <b>Hệ thống quản lý Minecraft Bot thế hệ mới với giao diện web Cyberpunk Neon.</b><br>
  Hỗ trợ Camera 3D thời gian thực · Tự động đào khoáng sản · AutoAuth · TPA · Anti-cheat
</p>

---

## 📋 Mục Lục

- [Tính Năng](#-tính-năng)
- [Yêu Cầu Hệ Thống](#-yêu-cầu-hệ-thống)
- [Cài Đặt Nhanh (Local)](#-cài-đặt-nhanh-local)
- [Hướng Dẫn Sử Dụng](#-hướng-dẫn-sử-dụng)
- [Cấu Trúc Thư Mục](#-cấu-trúc-thư-mục)
- [Deploy Lên Cloud](#-deploy-lên-cloud-online)
- [Câu Hỏi Thường Gặp](#-câu-hỏi-thường-gặp)

---

## ✨ Tính Năng

| Tính năng | Mô tả |
|-----------|-------|
| 🤖 **Điều khiển Bot** | Kết nối bot tới bất kỳ server Minecraft nào, hỗ trợ Offline & Microsoft Auth |
| 📷 **Camera 3D** | Xem góc nhìn của bot trong thời gian thực qua trình duyệt (Prismarine Viewer) |
| ⛏️ **Auto Mine** | Tự động tìm và đào khoáng sản: Kim cương, Đồng, Vàng, Sắt, Đá đỏ, Lapis... |
| 🗺️ **Bản Đồ Radar** | Radar phát hiện người chơi, mob xung quanh bot theo thời gian thực |
| 🔐 **Auto Auth** | Tự động đăng ký/đăng nhập AuthMe khi vào server có plugin xác thực |
| 🏃 **Tự Động Di Chuyển** | Bot tự đi về Lobby khi bị kick ra khỏi game, chống AFK kick |
| ⚔️ **TPA** | Gửi lệnh TPA/TPAHere và tự động chấp nhận yêu cầu teleport |
| 🛡️ **Anti-cheat** | Lọc dữ liệu radar để hiển thị khoáng sản ảo thay vì khoáng sản thật |
| 💬 **Chat** | Xem và gửi tin nhắn chat trực tiếp từ bảng điều khiển web |
| 🔄 **Auto Reconnect** | Tự động kết nối lại khi mất mạng hoặc bị kick |

---

## 🖥️ Yêu Cầu Hệ Thống

- **Node.js** phiên bản **18 trở lên** → [Tải tại đây](https://nodejs.org/)
- **Git** → [Tải tại đây](https://git-scm.com/)
- Trình duyệt: Chrome, Edge, Firefox, Brave (hỗ trợ WebGL)

---

## 🚀 Cài Đặt Nhanh (Local)

### Bước 1 — Tải về dự án

```bash
git clone https://github.com/Huyphan68080/BotMine.git
cd BotMine
```

### Bước 2 — Cài đặt thư viện Backend

```bash
cd backend
npm install
```

> Quá trình này sẽ tự động tải các thư viện cần thiết (Mineflayer, Socket.io, Pathfinder, v.v.)

### Bước 3 — Khởi động Backend Server

```bash
node server.js
```

Khi thấy thông báo này là server đã chạy thành công:

```
===================================================
 Minecraft Bot Manager Backend is running on port 3000
 Endpoint ping: http://localhost:3000/ping
===================================================
```

### Bước 4 — Mở Giao Diện Web

Mở trình duyệt và truy cập:

```
http://localhost:5500/frontend/index.html
```

Hoặc mở thẳng file `frontend/index.html` trong trình duyệt (double-click).

> **💡 Gợi ý:** Nếu dùng VS Code, cài extension **Live Server** rồi right-click vào `frontend/index.html` → **Open with Live Server** để có auto-reload.

---

## 📖 Hướng Dẫn Sử Dụng

### Kết Nối Bot

1. Mở giao diện web tại `http://localhost:5500/frontend/index.html`
2. Điền thông tin vào form **Cấu Hình Kết Nối Bot**:
   | Trường | Mô tả | Ví dụ |
   |--------|-------|-------|
   | **Địa chỉ Server** | IP hoặc domain của server Minecraft | `foxiemc.asia` |
   | **Cổng (Port)** | Port kết nối (mặc định 25565) | `25565` |
   | **Phiên bản** | Version Minecraft (chọn Auto để tự nhận diện) | `Auto (Tự nhận diện)` |
   | **Tên Bot** | Username của bot | `MyBot_123` |
   | **Mật khẩu** | Mật khẩu AuthMe (nếu server yêu cầu) | `password123` |
   | **Xác thực** | Offline (crack) hoặc Microsoft (premium) | `Offline (Crack)` |

3. Nhấn **KẾT NỐI BOT** — Bot sẽ tự động kết nối và hiển thị trạng thái.

### Tính Năng Nâng Cao

**🏠 Lobby / Xác thực:**
- Trong mục **Cài Đặt Nâng Cao**, bật cài đặt **Vật Phẩm Chọn Cụm** (ví dụ: `compass`) để bot tự đi lobby khi bị kick
- Chọn preset cụm máy chủ hoặc nhập địa chỉ lobby tùy chỉnh

**⛏️ Tự Động Đào:**
- Vào tab **Mô-đun Hack** → **Tự Động Đào**
- Chọn loại quặng muốn đào (Kim cương, Đồng, Vàng...)
- Bấm **BẮT ĐẦU ĐÀO** — bot sẽ tự động tìm và đào khoáng sản trong phạm vi

**📷 Camera 3D:**
- Nhấn **MỞ CAMERA** trong phần Camera 3D
- Camera hiển thị góc nhìn thứ nhất của bot theo thời gian thực

**🗺️ Radar:**
- Vào tab **Bản Đồ Radar** để xem vị trí các thực thể xung quanh bot
- Bot, Người chơi, Mob hiển thị theo màu sắc khác nhau

**🏃 TPA:**
- Nhập tên người chơi vào ô **TPA Target**
- Bấm **TPA** hoặc **TPA HERE** để gửi yêu cầu teleport
- Bật **Tự Động Đồng Ý TPA** để bot tự chấp nhận mọi yêu cầu

**💬 Chat:**
- Nhập tin nhắn vào ô chat ở cuối màn hình
- Bấm Enter hoặc nút gửi để chat trong game
- Lọc chat theo tab: Tất cả / Công khai / Riêng tư / Hệ thống

### Phím Tắt Điều Khiển Bot

| Phím | Hành động |
|------|-----------|
| `W` / `↑` | Tiến |
| `S` / `↓` | Lùi |
| `A` / `←` | Trái |
| `D` / `→` | Phải |
| `Space` | Nhảy |
| `Shift` | Sneaking |
| `Ctrl` | Chạy nhanh |
| `Fn+Up/Down/Left/Right` | Xoay nhìn (Look) |

---

## 📁 Cấu Trúc Thư Mục

```
BotMine/
├── backend/
│   ├── server.js         # Core: Socket.io, Mineflayer, xử lý bot
│   ├── package.json      # Dependencies
│   └── package-lock.json
│
├── frontend/
│   ├── index.html        # Giao diện chính (Cyberpunk UI)
│   ├── app.js            # Logic frontend: Socket client, điều khiển, render
│   └── style.css         # CSS: Hệ màu Salarixi (Tím - Hồng Neon)
│
├── vercel.json           # Cấu hình deploy Vercel (frontend)
└── README.md
```

---

## ☁️ Deploy Lên Cloud (Online)

Để chạy BotMine online 24/7, bạn có thể deploy Frontend lên **Vercel** và Backend lên **Render**.

### Deploy Frontend → Vercel (miễn phí)

1. Đăng nhập [vercel.com](https://vercel.com/) bằng tài khoản GitHub
2. Nhấp **Add New → Project** → chọn repository `BotMine`
3. Vercel tự phát hiện `vercel.json` → nhấp **Deploy** (không cần cấu hình gì thêm)
4. Nhận URL dạng `https://botmine-ten-ban.vercel.app`

### Deploy Backend → Render (miễn phí)

1. Đăng nhập [render.com](https://render.com/) bằng GitHub
2. Nhấp **New → Web Service** → chọn repo `BotMine`
3. Điền cài đặt:

   | Tùy chọn | Giá trị |
   |-----------|---------|
   | **Root Directory** | `backend` |
   | **Runtime** | `Node` |
   | **Build Command** | `npm install` |
   | **Start Command** | `npm start` |

4. Thêm **Environment Variable**:
   - `FRONTEND_URL` = `https://botmine-ten-ban.vercel.app` (URL Vercel của bạn)

5. Nhấp **Deploy Web Service**

### Kết Nối Frontend với Backend Cloud

Sau khi deploy xong, mở frontend qua URL đặc biệt để tự động cấu hình backend:

```
https://botmine-ten-ban.vercel.app/?backend=https://ten-backend.onrender.com
```

---

## ❓ Câu Hỏi Thường Gặp

**Q: Bot kết nối bị lỗi "sai phiên bản"?**
> A: Chọn **"Auto (Tự nhận diện)"** trong ô Phiên Bản để bot tự phát hiện version của server.

**Q: Bot bị kick liên tục sau khi vào?**
> A: Bật **Tự Động Kết Nối Lại** và cấu hình **Lobby** trong phần Cài Đặt Nâng Cao.

**Q: Không thấy Camera 3D hoạt động?**
> A: Camera chỉ hoạt động khi backend đang chạy **local** (localhost). Trên Render thì tính năng camera bị giới hạn.

**Q: AuthMe không tự động đăng nhập?**
> A: Điền **Mật khẩu** vào ô `/login` trong form kết nối. Bot sẽ tự nhận diện lệnh `Please register` / `Please login` và tự động thực hiện.

**Q: Lỗi `ECONNREFUSED` khi kết nối?**
> A: Server Minecraft đang offline hoặc sai Port. Kiểm tra lại IP và Port.

---

<p align="center">
  <b>© 2026 Huy Phan. All rights reserved.</b><br>
  <sub>Phát triển bởi <a href="https://github.com/Huyphan68080">Huy Phan</a> · Powered by Mineflayer & Socket.io</sub>
</p>
