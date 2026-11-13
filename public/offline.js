const retry = document.getElementById("retry");
const state = document.getElementById("connection-state");

retry?.addEventListener("click", () => {
  if (!navigator.onLine && state) state.textContent = "Chưa có kết nối mạng. Bật Wi-Fi hoặc dữ liệu di động rồi thử lại.";
  else window.location.reload();
});

window.addEventListener("online", () => {
  if (state) state.textContent = "Thiết bị đã có mạng. Chạm Thử kết nối lại để tiếp tục.";
});
