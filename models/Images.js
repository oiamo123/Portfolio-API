const mongoose = require("mongoose");

const ImagesSchema = new mongoose.Schema(
  {
    href: String,
    alt: String,
    for: String,
  },
  { collection: "Images" }
);

module.exports = mongoose.model("Images", ImagesSchema);
