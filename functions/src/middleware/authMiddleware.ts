import * as admin from "firebase-admin";

const getAuthToken = (req, res, next) => {
	console.log("getting auth token");
	if (req.headers.authorization && req.headers.authorization.split(" ")[0] === "Bearer") {
		req.authToken = req.headers.authorization.split(" ")[1];
	} else {
		req.authToken = null;
	}
	next();
};

export const checkIfAuthenticated = (req, res, next) => {
	getAuthToken(req, res, async () => {
		try {
			const { authToken } = req;
			const userInfo = await admin.auth().verifyIdToken(authToken);
			req["currentUser"] = userInfo.uid;
			return next();
		} catch (error) {
			return res.status(401).send({ error: "You are not authorized to make this request" });
		}
	});
};

export const checkIfUser = (req, res, next) => {
	getAuthToken(req, res, async () => {
		try {
			const { authToken } = req;
			const userInfo = await admin.auth().verifyIdToken(authToken);
			if (userInfo.uid !== req.query.uid) throw Error();
			req["currentUser"] = userInfo.uid;
			return next();
		} catch (error) {
			return res.status(401).send({ error: "You are not authorized to make this request" });
		}
	});
};

export const checkIfAdmin = (req, res, next) => {
	getAuthToken(req, res, async () => {
		const { authToken } = req;
		await admin
			.auth()
			.verifyIdToken(authToken)
			.then((claims) => {
				if (claims.admin) {
					req["currentUser"] = claims.user_id; // set the currentUser header on the request to the uid
					return next();
				} else {
					return res.status(401).send({
						error: "You are not authorized to make this request. Permission needed: ADMIN",
					});
				}
			});
	});
};
