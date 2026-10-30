// Hari 1 Task 1/3: profil & preferensi pengguna yang sedang masuk.
import { Router } from "express";
import { authedUserId, requireAuth } from "../lib/auth";
import { invalidRequest } from "../lib/respond";
import { AccessibilitySchema, PreferencesSchema } from "../lib/validation";
import { clearAccessibility, getUserById, setAccessibility, updatePreferences } from "../services/users";

const router = Router();

router.get("/me", requireAuth, (_req, res) => {
  const user = getUserById(authedUserId(res));
  if (!user) return res.status(401).json({ error: "unauthorized", message: "Silakan masuk terlebih dahulu." });
  return res.status(200).json(user);
});

// Mengganti seluruh objek preferensi (bukan merge) — app selalu mengirim
// keadaan lengkap layar preferensinya.
router.put("/me/preferences", requireAuth, (req, res) => {
  const parsed = PreferencesSchema.safeParse(req.body);
  if (!parsed.success) return invalidRequest(res, parsed.error, "Preferensi tidak valid.");
  return res.status(200).json(updatePreferences(authedUserId(res), parsed.data));
});

// Profil aksesibilitas: data pribadi sensitif. Hari 1 hanya DISIMPAN —
// belum memengaruhi routing (Hari 3), dan tidak pernah dikirim ke LLM.
router.put("/me/accessibility", requireAuth, (req, res) => {
  const parsed = AccessibilitySchema.safeParse(req.body);
  if (!parsed.success) return invalidRequest(res, parsed.error, "Data aksesibilitas tidak valid.");
  return res.status(200).json(setAccessibility(authedUserId(res), parsed.data.needs));
});

router.delete("/me/accessibility", requireAuth, (_req, res) => {
  return res.status(200).json(clearAccessibility(authedUserId(res)));
});

export default router;
