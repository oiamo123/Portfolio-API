const mongoose = require("mongoose");

const ProjectToolsSchema = new mongoose.Schema(
  {
    ProjectID: Number,
    ToolID: Number,
  },
  { collection: "Project_Tools" }
);

module.exports = mongoose.model("Project_Tools", ProjectToolsSchema);
