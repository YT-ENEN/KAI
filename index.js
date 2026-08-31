const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

exports.grantQuestReward = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "需要登入。");

  // Phase 0 安全骨架：
  // 正式版本必須由伺服器驗證 questId、完成條件與是否已領取，
  // 不接受前端直接傳入任意金額或 EXP。
  throw new HttpsError("unimplemented", "Quest reward 將於 Phase 2/3 實作。");
});

exports.auditAdminAction = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "需要登入。");

  const actorRef = db.collection("users").doc(request.auth.uid);
  const actorSnap = await actorRef.get();
  if (!actorSnap.exists || actorSnap.data().role !== "admin") {
    throw new HttpsError("permission-denied", "僅限管理員。");
  }

  const { action, targetId = null, detail = null } = request.data || {};
  if (!action || typeof action !== "string") {
    throw new HttpsError("invalid-argument", "缺少 action。");
  }

  await db.collection("auditLogs").add({
    actorUid: request.auth.uid,
    action,
    targetId,
    detail,
    createdAt: FieldValue.serverTimestamp()
  });

  return { ok: true };
});
