import * as express from "express";
import { checkIfAdmin } from "./middleware/authMiddleware";
import { getFirestore } from "firebase-admin/firestore";
const db = getFirestore();
const router = express.Router();

router.get("/schoolLookup", checkIfAdmin, async (req, res) => {
	return await db.collection("schoolLookup").get();
});

export default router;
