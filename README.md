 <h1 align="center">Hi 👋, I'm Mob</h1>
<h3 align="center">Join the Cryptocurrency Market, make money from Airdrop - Retroactive with me</h3>

- <p align="left"> <img src="https://komarev.com/ghpvc/?username=mobonchain&label=Profile%20views&color=0e75b6&style=flat" alt="mobonchain" /> <a href="https://github.com/mobonchain"> <img src="https://img.shields.io/github/followers/mobonchain?label=Follow&style=social" alt="Follow" /> </a> </p>

- [![TopAME | Bullish - Cheerful](https://img.shields.io/badge/TopAME%20|%20Bullish-Cheerful-blue?logo=telegram&style=flat)](https://t.me/xTopAME)

# Hướng Dẫn Cài Đặt Pharos Testnet Bot
- **Chức năng:** Hỗ trợ **Faucet**, **Swap**, **Add LP**, **Check-in**, **Send to Friends**

---

## Yêu cầu
- Ví đã tham gia **[Pharos Testnet](https://t.me/xTopAME/2468)** và liên kết `Twitter` để **Faucet**

---

## Cấu Trúc File Dữ Liệu

1. **proxy.txt**:
   - Mỗi dòng chứa một proxy theo định dạng:
     ```
     https://username1:pass@host:port
     https://username2:pass@host:port
     ```

2. **wallet.txt**:
   - Mỗi dòng chứa một private key của ví Ethereum.
   - Định dạng:
     ```
     PrivateKey1
     PrivateKey2
     ```

3. **address.txt**:
   - Mỗi dòng chứa một địa chỉ ví để **Send PHRS**
   - Định dạng:
     ```
     0xWalletAddress1
     0xWalletAddress2
     ```

---

## Cài Đặt Trên Windows

### Bước 1: Tải và Giải Nén File

1. Nhấn vào nút **<> Code"** màu xanh lá cây, sau đó chọn **Download ZIP**.
2. Giải nén file ZIP vào thư mục mà bạn muốn lưu trữ.

### Bước 2: Cấu Hình Proxy, Wallet và Token

1. Mở file `proxy.txt` và nhâp vào danh sách `Proxy` theo cấu trúc dữ liệu phía trên
2. Mở file `wallet.txt` và nhập vào `Private Key` của các ví Ethereum bạn muốn sử dụng
3. Mở file `address.txt` và nhập vào `Địa chỉ ví` theo cấu trúc dữ liệu phía trên

### Bước 3: Cài Đặt Module

1. Mở **Command Prompt (CMD)** trong thư mục chứa mã nguồn.
2. Cài đặt các module yêu cầu bằng lệnh:
   ```bash
   npm install
   ```

### Bước 4: Chạy Tool

1. Chạy chương trình bằng lệnh:
   ```bash
   node main.js
   ```

2. Chọn tính năng
3. Tool sẽ bắt đầu xử lý các ví và proxy theo thứ tự.

---


## Nếu gặp phải bất kỳ vấn đề nào có thể hỏi thêm tại **[TopAME | Chat - Supports](https://t.me/yTopAME)**
