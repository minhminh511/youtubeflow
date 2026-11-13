# TubeFlow

Không gian lập kế hoạch nội dung YouTube bằng Next.js App Router, PostgreSQL và Drizzle ORM. Giao diện tiếng Việt, hướng dẫn thiết lập OAuth và kiểm tra cấu hình máy chủ. Lịch nội dung và kho ý tưởng vẫn hoạt động khi chưa cấu hình Google.

## YouTube Studio trong TubeFlow

Mục **YouTube Studio** trong thanh điều hướng gộp các chức năng quản lý kênh tương tự YouTube Studio, dùng dữ liệu thật từ YouTube Data API v3 và YouTube Analytics API sau khi kết nối kênh. Không có dữ liệu mẫu.

- **Tổng quan:** thông tin kênh, số video đã đồng bộ, lượt xem, lượt thích, bình luận và lịch phát hành sắp tới.
- **Nội dung:** đồng bộ danh sách video từ kênh (playlist uploads), tìm kiếm, lọc theo trạng thái YouTube (Công khai / Không công khai / Riêng tư) và trạng thái quản lý nội bộ. Mỗi video có thể mở chi tiết, xem video, mở YouTube Studio để chỉnh sửa metadata, thêm vào lịch nội dung, ghi chú quản lý và xóa khỏi TubeFlow (không xóa video trên YouTube).
- **Đăng video:** tải file video (tối đa 2GB, gửi theo từng phần 8MB) trực tiếp lên kênh qua resumable upload của YouTube Data API, với tiêu đề, mô tả, định dạng (Video dài / YouTube Shorts), trạng thái công khai và lên lịch phát hành. Mục Đăng video có xem trước nội dung với tiêu đề và thumbnail minh họa. Cần cấp thêm quyền `youtube.upload` bằng nút **Cấp quyền đăng video** trong tab Đăng video (kết nối lại với scope bổ sung). Cần thêm scope này vào Data Access trong Google Auth Platform. Video sau khi đăng có thể mất vài phút để xử lý.
- **Phân tích:** báo cáo kênh 28 ngày gần nhất và hiệu suất theo từng video (lượt xem, phút xem, thời gian xem trung bình, người đăng ký mới).
- **Bình luận:** đọc bình luận mới nhất của từng video. Ẩn, xóa hoặc trả lời bình luận tại YouTube Studio.

Chỉnh sửa tiêu đề, mô tả, thumbnail và các cài đặt nâng cao của video vẫn thực hiện tại YouTube Studio vì các thao tác đó cần quyền quản lý đầy đủ của YouTube. TubeFlow quản lý trạng thái nội bộ, liên kết kế hoạch và ghi chú.

## Edit Video/Image

Mục **Edit Video/Image** trong nhóm QUẢN LÝ là trình chỉnh sửa ảnh/video ngay trên trình duyệt, hiển thị tốt trên PC và mobile:

- **Nhập file:** chọn nhiều ảnh/video từ thiết bị, hoặc thêm ảnh bìa từ video đã đăng trong YouTube Studio.
- **Chỉnh sửa:** bộ lọc màu (Rực rỡ, Hoài cổ, Đen trắng, Ấm áp, Lạnh, Kịch tính), điều chỉnh độ sáng/tương phản/bão hòa, xoay 90°, lật ngang, cắt theo tỷ lệ (1:1, 16:9, 9:16 cho Shorts, 4:5, 3:2), thêm chữ (nội dung, cỡ, màu, vị trí), cắt đoạn video theo điểm bắt đầu/kết thúc và tắt tiếng.
- **Xem trước:** phát/tạm dừng, tua video, xem kết quả theo thời gian thực trên canvas.
- **Lưu file:** ảnh xuất PNG, video xuất WebM (ghi lại từ canvas qua MediaRecorder) để tải xuống thiết bị.
- **Đăng lên YouTube:** xuất file đã chỉnh sửa rồi đăng trực tiếp qua API tải lên hiện có (cần quyền `youtube.upload`). Video được xuất lại ở định dạng WebM từ trình duyệt.

Trình chỉnh sửa chạy hoàn toàn phía trình duyệt; file gốc không được gửi lên máy chủ trừ khi bạn chọn đăng lên YouTube.

## Ý tưởng & chiến lược và Kiếm tiền

### Ý tưởng & chiến lược

- **Gợi ý video:** sinh tiêu đề video và Shorts từ video hiệu quả nhất của kênh (nếu đã kết nối) và các trụ cột nội dung. Mỗi gợi ý có hook mở đầu và lý do; lưu vào kho ý tưởng hoặc đưa thẳng vào lịch nội dung.
- **Trụ cột nội dung:** CRUD các chủ đề chính của kênh (ví dụ: Mẹo quay phim, Review thiết bị). Gợi ý video bám theo các trụ cột này.
- **Đối thủ:** thêm kênh đối thủ bằng handle, xem số người đăng ký, lượt xem và số video mới nhất lấy trực tiếp từ YouTube Data API, đồng bộ định kỳ và so sánh với kênh của bạn.

### Kiếm tiền

- **Tiến độ YouTube Partner Program:** số người đăng ký thật, giờ xem 12 tháng từ YouTube Analytics, lượt xem Shorts 90 ngày (ước tính từ video ngắn đã đồng bộ), thanh tiến độ tới 1.000 người đăng ký / 4.000 giờ xem / 10 triệu lượt xem Shorts và trạng thái đủ điều kiện.
- **Checklist kiếm tiền:** xác minh 2 bước, AdSense, tuân thủ chính sách, không cảnh cáo bản quyền, nội dung gốc — lưu riêng cho từng không gian.
- **Nhật ký doanh thu:** ghi doanh thu từng tháng theo nguồn (Quảng cáo, Hội viên, Super Chat…), đặt mục tiêu doanh thu và theo dõi tiến độ.
- **Doanh thu thật từ YouTube:** cấp thêm quyền `yt-analytics-monetary.readonly` bằng nút trong mục Kiếm tiền để đọc ước tính doanh thu 28 ngày. Cần thêm scope này vào Data Access trong Google Auth Platform.

## Cloudflare Tunnel: xử lý 404 font/icon và 502 HMR

### Đọc đúng thông báo

| Thông báo | Ý nghĩa |
| --- | --- |
| Download the React DevTools… | Thông báo của bundle phát triển, không phải lỗi OAuth. Nếu đã chuyển production mà vẫn thấy, kiểm tra tab/bundle cũ. |
| /fonts/inter-*.woff2 hoặc /icons/icon-192.png trả 404 | File không được phục vụ ở URL đó. Kiểm tra đúng dự án, thư mục public và cổng đang chạy. APP_URL/token không tạo các file này. |
| Error while trying to use icon from Manifest | Thường là hậu quả của icon 404, trả HTML thay vì PNG hoặc file hỏng. Manifest dùng đường dẫn tương đối theo origin là đúng. |
| wss://…/_next/hmr trả 502 | Kết nối cập nhật nóng của Next.js dev không thiết lập được qua proxy. Không liên quan trực tiếp đến YouTube OAuth. |

Chỉ các dòng 502 chưa đủ để kết luận nguyên nhân chính xác. Kiểm tra log terminal cloudflared và Next.js: origin có chạy không, đúng cổng/protocol không, và request WebSocket có tới origin không. Cloudflare có hỗ trợ WebSocket; không mặc định kết luận Quick Tunnel không hỗ trợ nó. Không tắt TLS, không đặt allowed origins thành `*` và không dùng cấu hình Server Actions để che lỗi HMR.

### Khôi phục tài nguyên bị bỏ sót khi tải mã nguồn

Bản dự án này tự kiểm tra tài nguyên khi chạy `next dev` hoặc `next build` qua `next.config.ts`:

- Icon PNG được tạo lại từ SVG trong `scripts/prepare-assets.cjs` nếu thiếu hoặc sai kích thước.
- Font được khôi phục từ nguồn văn bản có checksum trong `assets/fonts/`. Cần giữ thư mục này khi xuất/chuyển mã nguồn. Font Inter kèm giấy phép SIL OFL.
- `/fonts/font-faces.css` chỉ khai báo những font tồn tại và có header WOFF2 hợp lệ. Nếu cả nguồn font lẫn file nhị phân đều thiếu, ứng dụng dùng phông hệ thống thay vì yêu cầu file không tồn tại.
- Các font là tùy chọn của cache offline; một font thiếu không làm hỏng toàn bộ bước cài service worker.

Trong thư mục có package.json:

1. Sau khi lấy bản mã mới, chạy `npm install`.
2. Chạy `node scripts/prepare-assets.cjs` để khôi phục, hoặc thêm `--check` để chỉ kiểm tra mà không ghi file.
3. Bắt buộc giữ đủ thư mục `public/` ở gốc dự án, không đặt vào `src/public/`.
4. Mở thử `http://127.0.0.1:3000/icons/icon-192.png` và `http://127.0.0.1:3000/fonts/inter-latin.woff2` khi máy chủ đang chạy. Icon phải là ảnh PNG, không phải trang HTML. Nếu localhost đã 404, sửa bản cục bộ trước khi xét tunnel.
5. Nếu localhost tải được mà URL tunnel không tải được, kiểm tra tunnel có trỏ đúng tiến trình/cổng hay không. Không đổi APP_URL để cố sửa đường dẫn file tĩnh.

Nếu dùng **output: standalone / Docker**: Next.js không tự chép `public/` và `.next/static/` vào thư mục standalone. Cần chép hai thư mục đó vào nơi chạy `server.js` theo tài liệu Next.js. Cấu hình mặc định của dự án không bật standalone.

### Cách chạy phù hợp để thử PWA trên iPhone

Không cần dùng dev/HMR để kiểm tra PWA. Chuẩn bị PostgreSQL và DATABASE_URL như bình thường. Dừng tiến trình `npm run dev` trước khi chạy production cùng cổng.

**Terminal ứng dụng**, tại thư mục dự án:

- `node scripts/prepare-assets.cjs`
- `npm run build`
- `npm run start -- --hostname 127.0.0.1 --port 3000`

**Terminal tunnel riêng**, trên cùng máy:

- `cloudflared tunnel --url http://127.0.0.1:3000`

Giữ cả hai terminal mở. Nếu tunnel hiện có đang hoạt động, có thể giữ nó thay vì tạo lại; bảo đảm địa chỉ/cổng origin của tunnel vẫn trùng với nơi Next.js đang lắng nghe. Dùng 127.0.0.1 rõ ràng giúp tránh nhầm localhost IPv4/IPv6. Nếu cloudflared và ứng dụng nằm trong các container khác nhau, localhost không trỏ sang container ứng dụng: cần đúng hostname dịch vụ trong mạng container.

Nếu Quick Tunnel tạo URL mới, sửa APP_URL thành URL HTTPS mới, cập nhật Authorized redirect URI trong Google Cloud và **chỉ khởi động lại terminal ứng dụng**. Đừng liên tục khởi động lại tunnel trong lúc đang chép URL. APP_URL chỉ được đọc phía máy chủ; thay giá trị rồi restart để tiến trình nhận lại môi trường.

Biến trong process, `.env.production.local` hoặc `.env.local` có thể ghi đè `.env`. Kiểm tra cùng tên biến ở những nơi đó nếu giao diện vẫn hiện localhost hay tên miền cũ. Không chia sẻ nội dung file chứa secret khi kiểm tra.

Khi thật sự cần sửa code bằng dev qua tunnel, `allowedDevOrigins` được tạo từ **đúng hostname trong APP_URL hợp lệ**. Sau khi thay APP_URL phải khởi động lại dev server. Không cho phép toàn bộ `*.trycloudflare.com`. Cấu hình này xử lý quyền truy cập dev origin, không phải cam kết sửa mọi lỗi proxy/WebSocket 502.

### APP_URL khác Authorized redirect URI

- APP_URL chỉ là origin, ví dụ `https://your-current-tunnel.trycloudflare.com`.
- Authorized redirect URI phải đầy đủ: `https://your-current-tunnel.trycloudflare.com/api/youtube/callback`.
- Dòng `# Authorized redirect URI = ...` trong `.env` **chỉ là chú thích**, không thay đổi OAuth Client. Dán URI đầy đủ tại Google Auth Platform → Clients → Web application → Authorized redirect URIs.
- Cần cả GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET của cùng OAuth Client; thông tin bị thiếu hoặc sai không phải nguyên nhân của 404 font/icon.
- Nếu đã chia sẻ YOUTUBE_TOKEN_SECRET, tạo khóa mới ở máy cá nhân bằng `openssl rand -hex 32`, lưu riêng và restart. Nếu đã có token mã hóa bằng khóa cũ, phải kết nối lại kênh. Không tự đổi khóa mỗi lần build hay mỗi lần đổi tunnel.

Cookie phiên/OAuth nhận diện đúng header `X-Forwarded-Proto: https` từ proxy và được gắn Secure khi kết nối ngoài dùng HTTPS.

### Kiểm tra ngay trong ứng dụng

Vào **Cài đặt → Chẩn đoán tài nguyên & Tunnel**, hoặc mở `/?view=settings&diagnostics=1`.

- Kiểm tra HTTP, kiểu dữ liệu, kích thước icon, font, manifest, service worker, chế độ dev/production và kết nối PostgreSQL qua chính origin đang mở.
- Các request tài nguyên có tham số tránh cache; không nhầm bản PWA cũ với file hiện tại trên máy chủ.
- Báo cáo tải xuống không có token hoặc giá trị các khóa Google.
- Chỉ dùng **Làm mới cache PWA** sau khi sửa tài nguyên. Tính năng này chỉ gỡ worker `/sw.js` của TubeFlow và cache có tiền tố TubeFlow, rồi tải lại; không xóa cookie, localStorage hoặc kế hoạch. Không cần Clear site data/xóa toàn bộ cookie vì không gian hiện tại được nhận diện qua cookie.

Quick Tunnel dùng để thử nghiệm; URL có thể đổi và ngừng hoạt động khi máy tính/tunnel dừng. Để dùng lâu dài trên Màn hình chính iPhone hoặc với Google OAuth, ưu tiên tên miền triển khai cố định hoặc named tunnel.

Tài liệu chính thức: https://developers.cloudflare.com/tunnel/troubleshooting/ · https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins · https://nextjs.org/docs/app/api-reference/config/next-config-js/output

## PWA và trải nghiệm iPhone

TubeFlow có manifest tại `/manifest.webmanifest`, chế độ `standalone`, tên và biểu tượng Apple Touch 180px, biểu tượng PWA 192/512px và bản maskable riêng. Ứng dụng dùng viewport-fit=cover, safe-area-inset, thanh tab dưới và hộp thoại dạng bảng trượt. Biểu mẫu mobile dùng chữ từ 16px để tránh Safari tự phóng to khi nhập. Trang khởi động từ manifest là Tổng quan; lịch trên mobile mặc định dùng danh sách thẻ, lịch tháng vừa màn hình và chọn ngày để xem nội dung.

### Thêm vào Màn hình chính iPhone

1. Mở **URL HTTPS ổn định của ứng dụng** bằng Safari. Nếu đang xem trong iframe/preview, dùng nút mở bản ứng dụng đầy đủ; không thêm trang trò chuyện hoặc trang chứa iframe.
2. Chạm **Chia sẻ** (hình vuông có mũi tên hướng lên). Trên một số bố cục Safari, mở menu trang rồi chọn Chia sẻ.
3. Chọn **Thêm vào Màn hình chính**. Nếu không thấy, kéo xuống cuối danh sách → Sửa tác vụ.
4. Bật **Mở dưới dạng ứng dụng web** nếu có, rồi chạm **Thêm**.
5. Mở biểu tượng **TubeFlow** từ Màn hình chính. Thanh địa chỉ trình duyệt không còn hiển thị. Không cần App Store và không cần cấu hình Google chỉ để cài giao diện PWA.

Có thể mở hướng dẫn từ gợi ý trên mobile, menu điều hướng, Cài đặt → TubeFlow trên màn hình chính, hoặc `/?install=1`. Safari iOS không hỗ trợ beforeinstallprompt; nút trong website chỉ hướng dẫn thao tác hệ thống, không tự cài. Chrome/Edge được hỗ trợ nút cài khi trình duyệt cung cấp sự kiện tương ứng. Gợi ý cài đặt có thể ẩn trong 7 ngày và không hiện trong chế độ standalone.

### Mạng, cập nhật và dữ liệu riêng tư

- Service worker chỉ lưu tài nguyên công khai: icon, font, các file build tĩnh và trang ngoại tuyến. **Không cache HTML ứng dụng, phản hồi `/api/`, OAuth callback, token, kế hoạch, báo cáo hoặc ảnh kênh.**
- Lưu kế hoạch, đọc dữ liệu YouTube và các thao tác máy chủ vẫn cần mạng. Nếu mất mạng khi đang nhập, lỗi lưu được hiển thị và nội dung trong biểu mẫu được giữ để người dùng chủ động thử lại; không có hàng đợi tự đồng bộ.
- Khi mở lại lúc mất mạng sau ít nhất một lần online, trang ngoại tuyến xuất hiện với nút thử lại. Trang này không giả lập danh sách kế hoạch hoặc trạng thái kết nối.
- Service worker mới chờ người dùng xác nhận cập nhật; không tự tải lại trong khi đang nhập. Khi thay đổi file ngoại tuyến/icon hoặc chính sách cache ở các lần phát hành sau, tăng `VERSION` trong `public/sw.js`. Tài nguyên Next.js có tên hash được tải mới theo bản dựng; HTML luôn đọc từ mạng.
- Từ iOS 17.2, cookie tại thời điểm cài được sao chép sang web app. Sau đó Safari và web app có vùng lưu trữ riêng; không có đồng bộ cookie liên tục. Phiên bản cũ hoặc xóa dữ liệu có thể tạo không gian mới. TubeFlow chưa có tài khoản khôi phục đa thiết bị: nên xuất bản sao trước khi cài lại hoặc xóa cookie.
- Đổi tên miền làm thay đổi nơi lưu trữ PWA, cookie và URI OAuth. Dùng tên miền triển khai ổn định thay cho URL preview tạm thời.

Kiểm thử: `node tests/pwa.mjs` kiểm tra manifest, icon, điều hướng, lưu dữ liệu thật, mất mạng và giới hạn cache. `node tests/iphone-webkit.mjs` kiểm tra giao diện bằng engine WebKit ở kích thước iPhone. Trình duyệt kiểm thử có thể cài bằng Playwright; bước Thêm vào Màn hình chính và thanh trạng thái thực tế vẫn cần xác nhận trên iPhone thật.

Tài liệu tham khảo: https://nextjs.org/docs/app/guides/progressive-web-apps · https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios · https://webkit.org/blog/14787/

## Bắt đầu nếu chưa quen triển khai

Trong ứng dụng, mở **Kết nối kênh → Làm cùng tôi**. Có thể mở trực tiếp đường dẫn `/?guide=1`. Hướng dẫn có 5 màn hình, nút mở đúng trang Google và checklist tải xuống để gửi người triển khai. Checklist không bao giờ chứa Client ID, Client Secret hoặc khóa được tạo.

**Ba nơi thao tác là khác nhau:**

1. **Google Cloud**: tạo dự án, bật hai API, cấu hình màn hình đồng ý, tạo OAuth Client và nhận Client ID/Secret.
2. **Dịch vụ đang chạy TubeFlow**: đặt 4 biến môi trường và triển khai lại. Đây không phải mục cài đặt của YouTube hay Google Cloud.
3. **TubeFlow**: kiểm tra máy chủ, bấm Kết nối kênh, đăng nhập Google và cấp quyền.

Nếu đang dùng bản triển khai trên web, không cần gõ lệnh terminal. Nếu chỉ có link xem trước mà không có quyền mở Environment Variables / Secrets của dự án, cần người quản trị triển khai thêm biến. Không gửi Client Secret trong chat.

### Thao tác cụ thể ở Google Cloud

1. Mở https://console.cloud.google.com/projectcreate, đăng nhập, đặt tên dự án TubeFlow, bấm Create. Chọn đúng dự án ở thanh trên cùng.
2. Mở lần lượt hai liên kết API ở phần dưới và bấm Enable. Nếu đã thấy Manage thì API đã bật.
3. Mở Google Auth Platform. Bấm Get started nếu chưa cấu hình. Điền App name là TubeFlow, email hỗ trợ, chọn External nếu dùng Gmail cá nhân, điền email liên hệ và hoàn tất.
4. Audience → Test users → Add users: thêm email thực sự quản lý kênh, rồi Save khi đang Testing.
5. Data Access → Add or remove scopes: chọn hai quyền chỉ đọc được liệt kê bên dưới và lưu.
6. Clients → Create client → Web application. Name: TubeFlow Web. Trong Authorized redirect URIs, Add URI và dán URI từ bước chọn URL trong hướng dẫn. Không dán nhầm vào Authorized JavaScript origins.
7. Bấm Create, sao chép hoặc tải Client ID và Client Secret ngay khi tạo. Hai giá trị phải từ cùng một Client.

### Thao tác cụ thể ở dịch vụ triển khai

- Mở trang quản trị của dịch vụ bạn dùng để xuất bản ứng dụng, chọn đúng dự án và tìm Environment Variables / Environment / Secrets.
- Tạo từng cặp tên–giá trị: GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET lấy từ Google; YOUTUBE_TOKEN_SECRET là khóa ngẫu nhiên từ 32 ký tự; APP_URL là URL gốc ứng dụng, không kèm /api/youtube/callback.
- Giữ nguyên DATABASE_URL và khóa YOUTUBE_TOKEN_SECRET nếu ứng dụng đã kết nối trước đó.
- Chọn đúng Production hoặc Preview nếu dịch vụ có phân chia môi trường, lưu rồi Redeploy / Restart. Chỉ tải lại trang web không đủ để cập nhật biến môi trường.
- **Nếu dùng Vercel:** chọn dự án → Settings → Environment Variables → Add Environment Variable → điền Key/Value → chọn môi trường → Save. Sau đó Deployments → bản triển khai phù hợp → ⋯ → Redeploy. Mở đúng URL của bản mới khi đã Ready.
- **Nếu dùng nền tảng khác:** theo mục Environment Variables / Secrets của nền tảng đó; tên nút triển khai có thể khác. Hướng dẫn không giả định preview đang chạy trên Vercel.

### Nếu thật sự muốn chạy dự án trên máy cá nhân

Cần mã nguồn dự án, Node.js 22 trở lên và PostgreSQL đã chạy. Các lệnh dưới đây gõ trong terminal máy tính, không phải ở Google Cloud.

1. Mở thư mục dự án trong VS Code. Chọn Terminal → New Terminal; thư mục hiện tại phải có package.json.
2. Cài thư viện bằng `npm install`.
3. Đặt DATABASE_URL trong .env hoặc môi trường terminal. Giữ nguyên giá trị đang dùng nếu cơ sở dữ liệu đã hoạt động. Tạo .env.local để thêm bốn biến Google; không đặt tên file thành .env.local.txt.
4. Với máy chủ cổng 3000, đặt APP_URL là http://localhost:3000 và thêm http://localhost:3000/api/youtube/callback vào Google OAuth Client.
5. Khi dùng cơ sở dữ liệu mới, chạy `npx drizzle-kit push` để tạo bảng. Drizzle đọc DATABASE_URL từ biến môi trường, .env.local hoặc .env. Kiểm tra đúng cơ sở dữ liệu trước khi chạy; không chấp nhận cảnh báo mất dữ liệu khi chưa kiểm tra và sao lưu.
6. Chạy `npm run dev`, giữ terminal mở rồi truy cập http://localhost:3000. Nếu terminal báo cổng khác, cập nhật APP_URL và URI Google cùng cổng.
7. Sau khi sửa biến môi trường, nhấn Ctrl+C để dừng máy chủ, rồi chạy lại `npm run dev`.
8. Mở phiên ứng dụng trên localhost để kiểm tra cấu hình của máy tính. Bấm kiểm tra tại URL preview chỉ kiểm tra máy chủ preview, không kiểm tra máy cá nhân.

Các giá trị để trống trong mẫu môi trường phải được điền thật. Tạo khóa trong hướng dẫn hoặc sửa ô URL không tự lưu chúng lên máy chủ.

## Kết nối YouTube từng bước

### 1. Tạo dự án và bật API

Mở https://console.cloud.google.com/, tạo hoặc chọn một dự án. Trong APIs & Services → Library, bật cả hai API trong cùng dự án:

- YouTube Data API v3: https://console.cloud.google.com/apis/library/youtube.googleapis.com
- YouTube Analytics API: https://console.cloud.google.com/apis/library/youtubeanalytics.googleapis.com

### 2. Cấu hình Google Auth Platform

Mở https://console.cloud.google.com/auth/overview.

1. Hoàn thành Branding: tên ứng dụng, email hỗ trợ và liên hệ.
2. Trong Audience, chọn External nếu dùng tài khoản Gmail. Nếu Publishing status là Testing, thêm email quản lý kênh vào Test users.
3. Trong Data Access, thêm hai scope: `https://www.googleapis.com/auth/youtube.readonly` và `https://www.googleapis.com/auth/yt-analytics.readonly`.
4. Trong Clients → Create client, chọn Web application. Đặt tên và thêm Authorized redirect URI theo bước 4 trước khi kết nối.
5. Lưu Client ID và Client Secret ở nơi an toàn. Hai giá trị phải thuộc cùng một OAuth Client.

### 3. Đặt biến môi trường ở máy chủ

Trong trang quản trị nơi triển khai, vào Settings → Environment Variables. Đặt đúng môi trường Production hoặc Preview:

- GOOGLE_CLIENT_ID: Client ID của OAuth Client Web application.
- GOOGLE_CLIENT_SECRET: Client Secret tương ứng.
- YOUTUBE_TOKEN_SECRET: chuỗi ngẫu nhiên ít nhất 32 ký tự. Có thể tạo bằng `openssl rand -hex 32` hoặc nút Tạo khóa bảo mật trong ứng dụng. Giữ nguyên khóa sau khi kết nối; đổi khóa khiến token cũ không giải mã được và cần kết nối lại.
- APP_URL: URL gốc thật của ứng dụng, ví dụ `https://ung-dung.example.com`, không thêm đường dẫn hoặc query string.

Khi chạy trên máy cá nhân, có thể dùng `.env.local` và `APP_URL=http://localhost:3000`. Không đưa file chứa bí mật lên Git và không dùng tiền tố NEXT_PUBLIC_. Không thay thế DATABASE_URL đã có khi thêm các biến Google.

Lưu biến và Redeploy/khởi động lại máy chủ. Nút Kiểm tra lại cấu hình chỉ đọc trạng thái hiện tại, không tự triển khai hoặc sửa biến.

### 4. Thêm Authorized redirect URI và kết nối

Trong Google Auth Platform → Clients → chọn OAuth Client, thêm:

- Máy cá nhân: `http://localhost:3000/api/youtube/callback`.
- Bản triển khai: `https://ung-dung.example.com/api/youtube/callback` với tên miền thật.

URI phải khớp tuyệt đối với APP_URL + `/api/youtube/callback`: giao thức, tên miền, cổng và đường dẫn. Không thêm dấu / sau callback. Mục Authorized JavaScript origins không thay thế Authorized redirect URIs. Localhost không phải địa chỉ của bản triển khai.

Lưu, đợi cấu hình Google có hiệu lực, quay lại đúng URL ứng dụng, chọn Kiểm tra lại cấu hình → Kết nối kênh. Đăng nhập tài khoản quản lý kênh và đồng ý cả hai quyền chỉ đọc. Không có thông tin Google hợp lệ thì ứng dụng không giả lập kết nối thành công.

## Lưu ý Google OAuth

- Ứng dụng External ở trạng thái Testing với quyền YouTube thường có refresh token hết hạn sau 7 ngày. Kết nối lại khi cần. Khi phát hành công khai, chuyển sang In production và đáp ứng yêu cầu xác minh của Google áp dụng cho ứng dụng.
- `redirect_uri_mismatch`: đối chiếu URI từng ký tự.
- `access_denied`: kiểm tra Test users và tài khoản đang đăng nhập.
- `invalid_client`: kiểm tra Client ID và Client Secret thuộc cùng OAuth Client Web application.
- Không lấy được dữ liệu: kiểm tra API được bật trong đúng dự án và cả hai scope đã được cấp.
- Số liệu Analytics có thể trễ vài ngày. Không có dữ liệu thì hiển thị trạng thái trống, không tạo số liệu mẫu.

## Bảo mật và phiên làm việc

Mỗi trình duyệt nhận cookie HttpOnly ngẫu nhiên. Cơ sở dữ liệu chỉ lưu mã băm cookie. Mọi kế hoạch, tiến độ và kết nối được giới hạn theo không gian của phiên đó. Chưa có tài khoản đăng nhập hoặc khôi phục không gian giữa các thiết bị; xuất dữ liệu trước khi xóa cookie.

OAuth sử dụng state ngẫu nhiên, cookie state mã hóa, PKCE S256, kiểm tra phiên, và quyền chỉ đọc. Token được mã hóa AES-256-GCM trước khi lưu PostgreSQL. Các secret và token không được gửi về trình duyệt. Ngắt kết nối yêu cầu thu hồi quyền ở Google và xóa token cục bộ; nếu Google không phản hồi, giao diện hướng dẫn thu hồi thủ công tại https://myaccount.google.com/connections.

Chức năng lịch là kế hoạch cá nhân, không tự động đăng video. Trạng thái bước 1, 2 và 4 là người dùng tự xác nhận; ứng dụng không có quyền kiểm tra cài đặt Google Cloud. Bước 3 tự động dựa trên sự hiện diện/định dạng biến môi trường; tính hợp lệ thực sự của Client ID/Secret chỉ được xác nhận khi hoàn tất OAuth.

## Phát triển

Cài dependencies bằng npm. Cấu hình DATABASE_URL. Sau khi PostgreSQL đã khởi động, áp dụng schema với `npx drizzle-kit push`. Chạy phát triển bằng `npm run dev`.

Kiểm tra trước khi triển khai: `npx next typegen`, `npm exec tsc -- --noEmit --pretty false`, `npm run build`. Endpoint `/api/health` kiểm tra kết nối PostgreSQL.

## Tài liệu chính thức

- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/youtube/v3/docs/channels/list
- https://developers.google.com/youtube/analytics/reference/reports/query
