# Chia tiền nhà (PWA)

App chia tiền nhà, ăn uống, đồ dùng chung cho người ở cùng. Cài được lên màn hình chính trên cả iPhone và Android, dữ liệu dùng chung qua Supabase và cập nhật realtime.

**Stack:** Vue 3 + TypeScript + Vite + vite-plugin-pwa · Supabase (Postgres, RLS, Realtime, Auth email + mật khẩu)

---

## 1. Tạo backend Supabase

1. Vào https://supabase.com, tạo project mới (gói Free là đủ). Chọn region **Singapore** cho nhanh.
2. **SQL Editor → New query**, dán toàn bộ nội dung `supabase/schema.sql` rồi bấm **Run**. Sau đó chạy lần lượt từng file trong `supabase/migrations/` theo thứ tự số (`001_…`, `002_…`). Chạy lại nhiều lần cũng không sao.
3. **Authentication → Sign In / Providers → Email**: bật **Email**. Muốn đăng ký xong vào luôn thì tắt **Confirm email**. Nếu để bật, người dùng phải bấm link trong email trước khi đăng nhập.
4. **Authentication → URL Configuration**: đặt **Site URL** là link app sau khi deploy (VD `https://chia-tien-nha.vercel.app`) và thêm link đó vào **Redirect URLs**. Link xác nhận email và link quên mật khẩu sẽ trỏ về đây.
5. **Project Settings → API** (hoặc **API Keys**), lấy:
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

1. **Tạo tài khoản** bằng email + mật khẩu, hoặc **Đăng nhập** nếu đã có. Đăng nhập trên máy nào cũng thấy đủ các nhóm của mình.
2. **Tạo nhóm mới** (bạn là chủ nhóm) hoặc **Tham gia bằng mã nhóm**. Một tài khoản ở được nhiều nhóm.
3. Chạm vào tên mình ở góc trên → **Mời bạn cùng nhà** → **Gửi link** hoặc **Chép link mời**.
4. **Đổi nhóm:** chạm vào tên nhóm ở đầu trang. Tab **Tất cả** là mọi nhóm bạn tham gia, tab **Nhóm của tôi** là nhóm bạn làm chủ. Mở app sẽ vào lại nhóm xem gần nhất (lần đầu là nhóm tham gia sớm nhất).
5. **Quên mật khẩu:** bấm **Quên mật khẩu?** ở màn đăng nhập để nhận link đặt lại qua email.

**Nâng cấp từ bản cũ (tên + PIN):** chỉ cần chạy `supabase/migrations/001_accounts.sql`, dữ liệu cũ vẫn giữ nguyên. Mỗi người tạo tài khoản, nhập mã nhóm, chạm vào tên cũ của mình rồi nhập PIN cũ, để gắn tên đó cùng các khoản chi cũ vào tài khoản. Ai quên PIN thì chủ nhóm vào tab **Chung**, chạm vào tên người đó → **Đặt lại PIN**. Không biết mã nhóm thì xem trong Supabase → Table Editor → `groups` → `invite_code`.

## Bảo mật

- Đăng nhập bằng Supabase Auth (email + mật khẩu). Mỗi dòng `members` gắn với một tài khoản (`members.user_id`), một tài khoản có thể ở nhiều nhóm. Phiên ẩn danh của bản cũ sẽ tự đăng xuất.
- PIN chỉ còn dùng để nhận lại thành viên cũ chưa có tài khoản. PIN được hash bằng bcrypt (`pgcrypto`) trong `member_secrets`, client không đọc được bảng này, và PIN bị xóa ngay sau khi nhận lại tên. Nhập sai 5 lần thì bị khóa 15 phút.
- **Row Level Security:**
  - Mỗi người chỉ đọc được dữ liệu của các nhóm mình tham gia.
  - Mỗi người chỉ sửa được profile của chính mình, và chỉ các cột `name, bank, acc, holder, qr_data`. Không tự nâng quyền admin được.
  - Trigger kiểm tra người trả và người được chia phải thuộc cùng nhóm.
- Ảnh QR được thu nhỏ (< 190KB) và lưu dạng data URL trong cột `members.qr_data`. Database chỉ chấp nhận `data:image/...`.

## Cấu trúc

```
supabase/schema.sql        Schema gốc: bảng, trigger, realtime
supabase/migrations/       Thay đổi về sau, mỗi lần một file đánh số, chạy sau schema.sql
  001_accounts.sql         Tài khoản + nhiều nhóm: RLS, RPC (my_groups, create_group, join_group, ...)
src/store.ts               State + gọi Supabase + realtime
src/lib/money.ts           Tính nợ theo cặp, định dạng tiền, parse "150k", "2.5tr"
src/lib/image.ts           Nén ảnh QR
src/components/
  AuthView.vue             Đăng nhập / tạo tài khoản / quên mật khẩu
  Onboarding.vue           Tạo nhóm / tham gia bằng mã (cũng dùng trong sheet thêm nhóm)
  GroupsSheet.vue          Danh sách nhóm, tab "Tất cả" / "Nhóm của tôi", đổi nhóm
  MainView.vue             Header, tab "Của tôi" / "Chung" (vuốt ngang), bottom sheet
  MinePanel.vue            Tổng nợ của tôi, tôi nợ ai, ai nợ tôi
  SharedPanel.vue          Số dư mọi người, ai nợ ai, thống kê và danh sách theo tháng
  ExpenseSheet.vue         Thêm / sửa / xóa khoản chi
  PaymentSheet.vue         Trả một phần hoặc trả hết, kèm STK + QR người nhận
  ProfileSheet.vue         STK, QR, link mời, đăng xuất
  MemberSheet.vue          Xem STK/QR người khác, admin đặt lại PIN
public/                    Icon PWA
```

## Thay đổi database

Không sửa `schema.sql` hay migration đã chạy. Muốn đổi gì thì tạo file mới `supabase/migrations/00N_ten.sql` (số tiếp theo), viết sao cho chạy lại được (`if not exists`, `create or replace`, `drop … if exists`). Lên Supabase thì chỉ chạy file mới.

## Cách tính nợ

Mỗi khoản chi chia đều cho những người được chọn. Ai không phải người trả thì nợ người trả phần của mình. Nợ được bù trừ theo từng cặp người: A nợ B 100k, B nợ A 30k thì hiện A nợ B 70k. Mỗi lần thanh toán (một phần hoặc hết) trừ thẳng vào khoản nợ giữa đúng hai người đó.
