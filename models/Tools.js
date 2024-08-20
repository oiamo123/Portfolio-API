const mongoose = require("mongoose");

const ToolsSchema = new mongoose.Schema(
  {
    _id: Number,
    tool: String,
    category: String,
  },
  { collection: "Tools" }
);

module.exports = mongoose.model("Tools", ToolsSchema);
