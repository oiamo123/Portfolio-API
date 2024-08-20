const mongoose = require("mongoose");

const Timeline = new mongoose.Schema(
  {
    yearmo: String,
    title: String,
    description: String,
  },
  { collection: "Timeline" }
);

module.exports = mongoose.model("Timeline", Timeline);
