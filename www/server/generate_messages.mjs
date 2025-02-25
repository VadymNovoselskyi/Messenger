import fs from "fs";

function generateMessages(startMessage = 1, totalMessages, cid, from) {
  const messages = [];
  const now = new Date(); // Current time
  const startTime = new Date(now.getTime() - (totalMessages - 1) * 60000); // Start (totalMessages - 1) minutes ago

  for (let i = 0; i < totalMessages; i++) {
    const hexId = (startMessage + i).toString(16).padStart(24, "0"); // Unique _id
    const sendTime = new Date(startTime.getTime() + i * 60000); // Increment by 1 minute

    messages.push({
      _id: { $oid: hexId },
      cid: { $oid: cid },
      from: { $oid: from },
      text: String(startMessage + i),
      sendTime: { $date: sendTime.toISOString() },
    });
  }

  return messages;
}

// Generate messages where the last one is sent "now"
const messages = generateMessages(
  3100001,
  1000000,
  "67af9ef70f2924a7f38531c5",
  "67a4ead33a3db3f03a28d1b8"
);
fs.writeFileSync("messages.json", JSON.stringify(messages, null, 2));
console.log("messages.json file created successfully.");
