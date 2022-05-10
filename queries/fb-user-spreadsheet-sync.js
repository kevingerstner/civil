function getFireStore() {
	var config = {
		project_id: "civil-ed",
		private_key:
			"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC2km+xF49Ydzz7\ndCvj7W6KnhZFIREhBR0OuHSXG9TyVqnEUGyCjP6gezqZsEtq5mQJjrxRa5vUjEdx\nmnwUyukm0DYpgpafAHqX27+BUP1c7RIrtG9+60rB5KvIpjpIQ3FF7QUifm9U1VdF\nRW3mktDk0g5tuJzX7kuDZ5q5QkCYEkmnn9cBlH9co2hgOfsE0n0Wi79GjRvY6nNX\nif/b0oK5ary1ZtOvFwyhfd4Rh8ovKUb0iu9sDCYkBPhsztj+J/eM9k2fC9F//I56\nDOv45V63XBTKqpKZKuOn4G4DTGCdrjCytZfuzZgBiYRRZVOkS9jVDh070wRSb5RQ\nxeURxjBTAgMBAAECggEACInWsWiRqqiA8J2hQ9qh1dfI4NjIDUxI7JxRz5NcpSzK\nacT9Hinr6qN4vSFSlaBKw2uqgQBQXGNnH/gCn5JRzx/juJND6hHCqgF79ldMUiFA\nPU0F/eCRMXo5Unv7s897p7KLD+7r1ALaPwIdPrBVFq6AQD9nDm41l+KriMiBbtsv\nz3VOvRasAUHTwjijKFswMXc/pSVNM2R2Fem4CNqJSVl8AVOg/KsJTULLzwW53F4x\nEVTPAkIYyUtB16+LGtsyWkGyLMwV/GGE6dN26gbpRk5z8NoFd2tDXqB2LuWI9iUU\nVmMC0TuukhGdATNHKWkUNxWEi9UEHf11D+D9TLzeGQKBgQDqH1/z+Fcyi3oOdxcS\n77XQshWgI6vyhtqW/imD9Kq4GaDhZMswdqd/nbZVQN37IEaYJ0IuJ3lm8Vi5qEoS\n1TWG0hCzi5/fM7olo6uEC1YmtEOKiy0IwUppB2b2URtzWQdECRem1QZGG24rzXoz\ncnM4JSuoDmYaqVCb+MV20n6z9wKBgQDHoeGn3kYlUPd8fEWe6pHPqxXkowJf+Hgk\nULTuSFRMQy4OMlHGxtd072Q4EBi87PhyNBy1pwnucI9rCjqJ/VKPAuPlNLnPAwzu\nB2CXqZX1glM8i6rIHXmDEmoy17d+ywnGtDIDHxUYyhxs6SAiDunIA1jXdJ/Iau5w\nQXIsyZSXhQKBgG0NxkU/NWa+31DjmiTg8aDPgxE/7HUg6asRosbrbaYpke3LZHYj\nnuvry6W0fHHgW+G9z67uBje0Te7U/AP/ulodeVgYvpRaZOfpcBgmq6+FojxjjcuZ\nNY7susIbj5zQKHlBfvngGncHie7vXG+gbRkG/2ndoyPiIEE2xMwPSqOLAoGBAIeD\nDNHN4WHdV1IqbXwVkMseQKtGOAt7d9p26orBkG+APtgmMjqzqXfYNPiVfKVqWq/z\nTfXFIMm5oLExbVFUI2GuvZJOOz8ZvAIsAdaRqJjSUbxMtq5Gy8A8lNhUdFveaZF3\nqmdSBxkfwTHxAf38j5dVJk6C/R+n7plG48EhSPudAoGANCNIY19fIOnIrehEZHGj\n5FOsGHMsjnzQgmToKZL4VOCYjXgjuLLIOa+MehMmkM9VpmFdj9VP4uzCTFWmBDRQ\nyJSlXWB3vfv6w8HF6hCeaO3xcG14lkHOkyaQojtD7MKNtvHBtz9i+C2pBKuQjDtI\njK6gbk70o3jQPuIdYsYewnU=\n-----END PRIVATE KEY-----\n",
		client_email: "firebase-adminsdk-xp5d0@civil-ed.iam.gserviceaccount.com",
	};

	var firestore = FirestoreApp.getFirestore(
		config.client_email,
		config.private_key,
		config.project_id
	);
	var ss = SpreadsheetApp.getActiveSpreadsheet();
	var sheet = ss.getActiveSheet();

	// the following lines depend on the structure of your database
	// specify the document in the Firestore to access by replacing the countries with the name of your database
	const allDocuments = firestore.getDocuments("users");

	// start by clearing data
	var clearRange = sheet.getDataRange();
	clearRange.clearContent();

	// set header row
	var headerRow = [
		"First Name",
		"Last Name",
		"Email",
		"Job Title",
		"Location",
		"Provisioned",
		"Referral",
		"School Name",
		"Create Date",
		"Last Updated",
		"ID",
	];
	sheet.appendRow(headerRow);

	// for each column and row in the document selected
	for (var i = 0; i < allDocuments.length; i++) {
		//initializes the  array to be printed to Google Sheets
		var myArray = [];

		//accessing the first column, replace the “name” with the header of your first column
		var firstName = allDocuments[i].fields["firstName"].stringValue;
		myArray.push(firstName);

		//accessing the second column that has several entries, replace the “cities” with the header of your second column
		var lastName = allDocuments[i].fields["lastName"].stringValue;
		myArray.push(lastName);

		//accessing the third column, replace the “capital” with the header of your third column
		var email = allDocuments[i].fields["email"];
		myArray.push(email.stringValue);

		var jobTitle = allDocuments[i].fields["jobTitle"];
		myArray.push(jobTitle.stringValue);

		var location = allDocuments[i].fields["location"];
		myArray.push(location.stringValue);

		var provisioned = allDocuments[i].fields["provisioned"];
		if (provisioned) myArray.push(provisioned.stringValue);
		else myArray.push(false);

		var referral = allDocuments[i].fields["referral"];
		myArray.push(referral.stringValue);

		var schoolName = allDocuments[i].fields["schoolName"];
		myArray.push(schoolName.stringValue);

		var createDate = allDocuments[i].createTime;
		myArray.push(createDate);

		var updateDate = allDocuments[i].updateTime;
		myArray.push(updateDate);

		var id = allDocuments[i].name.split("/").pop();
		myArray.push(id);

		sheet.appendRow(myArray);
	}
}

function findUserRow(userId) {
	var sheet = SpreadsheetApp.getActiveSheet();
	var values = sheet.getRange("K:K").getValues();
	for (var row = 0; row < values.length; row++) {
		if (values[row][0] === userId) return row + 1;
	}
	return -1;
}

function updateRow() {
	// CODE FOR UPDATING A ROW
	var range = sheet.getRange(1, myArray.length, 1, 1);
	var endColumnName = range.getA1Notation().match(/([A-Z]+)/)[0];

	var rowMatch = findUserRow(id);
	if (rowMatch !== -1) {
		var rowData = sheet.getRange(rowMatch + ":" + rowMatch).getValues();
		console.log(
			firstName +
				" " +
				lastName +
				" [" +
				id +
				"] MATCHES ROW " +
				rowMatch +
				"(" +
				rowData[0][10] +
				")"
		);
		sheet.getRange("A" + rowMatch + ":" + endColumnName + rowMatch).setValues([myArray]);
	}
}
