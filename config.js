/* 銳能娛樂 中央控制中心 設定檔
 * 已經有 config.js 的話，保留原本的 API_URL 即可，不用換掉。
 */
window.REBORN_CONFIG = {
  // Apps Script「網頁應用程式」部署網址（結尾是 /exec）。留空會進入預覽模式。
  API_URL: 'https://script.google.com/macros/s/AKfycbyAjOBsm0bkNBm9qo45dT9RqDeX5oH8Ch91mpP_wk96nPavp3-ZfwahjEnJKjkCd0TZRw/exec',

  // 登入狀態存在瀏覽器裡的名稱，一般不用改
  SESSION_KEY: 'rn_central_session',

  // LOGO 圖片網址。留空時會依序找：同資料夾的 logo.png → 原本的 LOGO 網址
  LOGO_URL: ''
};
