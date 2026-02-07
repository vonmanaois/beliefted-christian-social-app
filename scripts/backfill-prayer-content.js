// eslint-disable-next-line @typescript-eslint/no-require-imports
const mongoose = require("mongoose");

const run = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  await mongoose.connect(uri);

  const collection = mongoose.connection.collection("prayers");
  const result = await collection.updateMany(
    { content: { $exists: false } },
    { $set: { content: "" } }
  );

  console.log(`Backfill complete. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("Backfill failed:", error);
  mongoose.disconnect();
  process.exit(1);
});
