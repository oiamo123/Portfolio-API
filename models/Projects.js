const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    _id: Number,
    body: String,
    img: String,
    href: String,
    title: String,
  },
  { collection: "Projects" }
);

module.exports = mongoose.model("Project", projectSchema);
