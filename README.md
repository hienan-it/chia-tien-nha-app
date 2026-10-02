# Chia tiền nhà (PWA)

App chia tiền nhà, ăn uống, đồ dùng chung cho người ở cùng. Cài được lên màn hình chính trên cả iPhone và Android, dữ liệu dùng chung qua Supabase và cập nhật realtime.

**Stack:** Vue 3 + TypeScript + Vite + vite-plugin-pwa · Supabase (Postgres, RLS, Realtime, Anonymous Auth)

---

## 1. Tạo backend Supabase

1. Vào https://supabase.com, tạo project mới (gói Free là đủ). Chọn region **Singapore** cho nhanh.
2. **SQL Editor → New query**, dán toàn bộ nội dung `supabase/schema.sql` rồi bấm **Run**. File chạy lại nhiều lần cũng không sao.
3. **Authentication → Sign In / Providers**, bật **Allow anonymous sign-ins**.
4. **Project Settings → API** (hoặc **API Keys**), lấy:
   - `Project URL`
   - `anon public` key (project mới có thể gọi là `publishable` key)

> Lưu ý: project Free sẽ tạm dừng nếu không có ai dùng trong 7 ngày. Dùng hằng ngày thì không sao; nếu bị dừng, vào dashboard bấm Restore.

## 2. Chạy thử trên máy

```bash
cp .env.example .env      # rồi điền URL và key vừa lấy
npm install
npm run dev               # mở http://localhost:5173
```

Muốn mở thử trên điện thoại cùng mạng wifi: `npm run dev -- --host` rồi mở địa chỉ IP hiện ra. Chức năng **cài app** chỉ hoạt động khi có HTTPS, nên hãy thử cài sau khi deploy.

## 3. Deploy (miễn phí, có HTTPS)

**Vercel**
1. Đẩy code lên GitHub (file `.env` đã nằm trong `.gitignore`, không bị đẩy lên).
2. Vào https://vercel.com, chọn **Add New → Project** rồi import repo. Framework tự nhận là **Vite**.
3. Ở **Environment Variables**, thêm `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`.
4. Bấm **Deploy**, bạn sẽ có link dạng `https://chia-tien-nha.vercel.app`.

**Netlify** làm tương tự: Build command `npm run build`, Publish directory `dist`, thêm 2 biến môi trường.

Mỗi lần push code mới, Vercel/Netlify tự build lại. App trên điện thoại tự cập nhật ở lần mở tiếp theo.

## 4. Cài lên điện thoại

- **Android (Chrome):** mở link, bấm **Cài** trên banner, hoặc menu ⋮ → **Cài đặt ứng dụng**.
- **iPhone (Safari):** mở link, bấm nút **Chia sẻ** → **Thêm vào MH chính**. Phải dùng Safari, Chrome trên iPhone không cài được.

## 5. Cách dùng

1. **Người tạo nhóm:** bấm **Tạo nhóm mới**, nhập tên nhóm, tên mình và PIN 4 số.
2. Chạm vào tên mình ở góc trên → phần **Mời bạn cùng nhà** → **Gửi link** hoặc **Chép link mời**.
3. **Người được mời:** mở link (hoặc nhập mã nhóm 6 ký tự), nhập tên, đặt PIN, rồi vào thêm STK và ảnh QR của mình.
4. **Đổi máy / cài lại app:** nhập mã nhóm, chạm vào tên mình, nhập PIN.
5. **Quên PIN:** người tạo nhóm vào tab **Chung**, chạm vào tên người đó → **Đặt lại PIN**.

## Bảo mật

- Mỗi thiết bị đăng nhập ẩn danh (anonymous user). Nhập đúng tên + PIN thì thiết bị được gắn vào profile tương ứng (bảng `sessions`).
- PIN được hash bằng bcrypt (`pgcrypto`) trong bảng `member_secrets`. Client không đọc được bảng này.
- Nhập sai PIN 5 lần thì profile bị khóa 15 phút.
- **Row Level Security:**
  - Mỗi người chỉ đọc được dữ liệu của nhóm mình.
  - Mỗi người chỉ sửa được profile của chính mình, và chỉ các cột `name, bank, acc, holder, qr_data`. Không tự nâng quyền admin được.
  - Trigger kiểm tra người trả và người được chia phải thuộc cùng nhóm.
- Ảnh QR được thu nhỏ (< 190KB) và lưu dạng data URL trong cột `members.qr_data`. Database chỉ chấp nhận `data:image/...`.

## Cấu trúc

```
supabase/schema.sql        Bảng, RLS, RPC (create_group, enter_group, ...), realtime
src/store.ts               State + gọi Supabase + realtime
src/lib/money.ts           Tính nợ theo cặp, định dạng tiền, parse "150k", "2.5tr"
src/lib/image.ts           Nén ảnh QR
src/components/
  Onboarding.vue           Tạo nhóm / nhập mã / nhập tên + PIN
  MainView.vue             Header, tab "Của tôi" / "Chung" (vuốt ngang), bottom sheet
  MinePanel.vue            Tổng nợ của tôi, tôi nợ ai, ai nợ tôi
  SharedPanel.vue          Số dư mọi người, ai nợ ai, thống kê và danh sách theo tháng
  ExpenseSheet.vue         Thêm / sửa / xóa khoản chi
  PaymentSheet.vue         Trả một phần hoặc trả hết, kèm STK + QR người nhận
  ProfileSheet.vue         STK, QR, link mời, đổi PIN, đăng xuất
  MemberSheet.vue          Xem STK/QR người khác, admin đặt lại PIN
public/                    Icon PWA
```

## Cách tính nợ

Mỗi khoản chi chia đều cho những người được chọn. Ai không phải người trả thì nợ người trả phần của mình. Nợ được bù trừ theo từng cặp người: A nợ B 100k, B nợ A 30k thì hiện A nợ B 70k. Mỗi lần thanh toán (một phần hoặc hết) trừ thẳng vào khoản nợ giữa đúng hai người đó.
