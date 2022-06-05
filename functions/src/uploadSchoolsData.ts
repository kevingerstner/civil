import { getStorage, getStream, ref } from "firebase/storage";
import * as functions from "firebase-functions";
import csv from "csv-parser";
import { getFirestore } from "firebase-admin/firestore";
const db = getFirestore();

/**
 * Imports school data
 */
exports.importSchoolDataTest = functions.https.onRequest(async (req, res) => {
	const storage = getStorage();
	const results: any = [];
	let docsAdded = 0;
	let totalDocsToAdd: number;

	setTimeout(timedOut, 520000);

	getStream(ref(storage, "Private_Schools.csv"))
		.pipe(csv())
		.on("data", (data: any) => results.push(data))
		.on("err", (err) => {
			res.status(400).send("An error occurred. Whoopsies!");
		})
		.on("end", async () => {
			totalDocsToAdd = results.length;
			for (let count = 0; count < results.length; count++) {
				results[count]["SCHOOL TYPE"] = "PRIVATE";
				const row = results[count];
				await db.collection("schoolLookup").add(row);
				docsAdded++;
			}
			res.status(200).send("Successfully added " + docsAdded + "/" + totalDocsToAdd + " DOCS");
		});
	/**
	 * Checks for timeout
	 */
	function timedOut() {
		console.log("TIMED OUT. SUCCESSFULLY ADDED " + docsAdded + "/" + totalDocsToAdd + " DOCS");
	}
});

/**
 * Imports school data
 */
exports.importPublicSchoolData = functions.https.onRequest(async (req, res) => {
	const storage = getStorage();
	const results: any = [];
	let docsAdded = 0;
	let totalDocsToAdd: number;

	setTimeout(timedOut, 520000);

	getStream(ref(storage, "Public_Schools_Import.csv"))
		.pipe(csv())
		.on("data", (data: any) => results.push(data))
		.on("err", (err) => {
			res.status(400).send("An error occurred. Whoopsies!");
		})
		.on("end", async () => {
			totalDocsToAdd = results.length;
			for (let count = 0; count < results.length; count++) {
				results[count]["SCHOOL TYPE"] = "PUBLIC";
				const row = results[count];
				await db.collection("schoolLookup").add(row);
				docsAdded++;
			}
			res.status(200).send("Successfully added " + docsAdded + "/" + totalDocsToAdd + " DOCS");
		});

	/**
	 * Checks for timeout
	 */
	function timedOut() {
		console.log("TIMED OUT. SUCCESSFULLY ADDED " + docsAdded + "/" + totalDocsToAdd + " DOCS");
	}
});
