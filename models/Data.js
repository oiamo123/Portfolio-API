const mongoose = require("mongoose");

const DataSchema = new mongoose.Schema(
  {
    key: String,
    for: String,
  },
  { collection: "Keys" }
);

module.exports = mongoose.model("Keys", DataSchema);
