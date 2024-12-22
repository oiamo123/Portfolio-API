const fs = require("fs");
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const dotenv = require("dotenv");
const rateLimit = require("express-rate-limit");
const { decrypt } = require("./crypto/crypto.js");
const {
  emailSchema,
  validateSchema,
  validateRecaptcha,
} = require("./validation/validation.js");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
});

const allowedOrigins = {
  development: "http://localhost:4321",
  production: "https://goiamo.dev",
};

const app = express();
app.set("trust proxy", 1);
app.use(limiter);
app.use(
  cors({
    origin: allowedOrigins[process.env.ENV] || "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.use(express.urlencoded());
app.use(express.json());

dotenv.config();

const Projects = require("./models/Projects.js");
const Tools = require("./models/Tools");
const Project_Tools = require("./models/Project-Tools.js");
const Images = require("./models/Images.js");
const Timeline = require("./models/Timeline.js");
const Data = require("./models/Data.js");

// middleware
mongoose.connect(process.env.URI).then(() => {
  console.log("Connected to MongoDB Atlas");
});

// handle pre-flight
app.options("*", cors());

// notes directory
const notesDirectory = path.join(__dirname, "notes");

// routes
app.get("/api/images", async (req, res) => {
  try {
    const images = await Images.find({ for: "profile" }).lean();
    if (!images) {
      res.status(400).json({ message: "Unable to retrieve image" });
    }

    res.status(200).json(images);
  } catch (err) {
    res.status(400).json({ message: "An error occured" });
  }
});

app.get("/api/timeline", async (req, res) => {
  try {
    const timeline = await Timeline.find({}).lean();
    if (!timeline) {
      res
        .status(400)
        .json({ message: "There was an issue receiving the timeline data" });
    }

    res.status(200).json(timeline);
  } catch (err) {
    res.status(400).json({ message: "An error occured" });
  }
});

app.get("/api/skills", async (req, res) => {
  try {
    const tools = await Tools.find({}).lean();
    if (!tools) {
      res.status(400).json({ message: "There was an issue loading the tools" });
    }
    res.status(200).json(tools);
  } catch (err) {
    res.status(400).json({ message: "An error occured" });
  }
});

app.get("/api/projects", async (req, res) => {
  try {
    // get projects, tools and project tools
    const [projects, tools, project_tools] = await Promise.all([
      Projects.find({}).lean(),
      Tools.find({}).lean(),
      Project_Tools.find({}).lean(),
    ]);

    const projectsAndTools = projects.map((project) => {
      project.tools = [];

      project_tools.forEach((projectTool) => {
        if (project._id.toString() === projectTool.ProjectID.toString()) {
          const tool = tools.find(
            (tool) => tool._id.toString() === projectTool.ToolID.toString()
          );

          project.tools.push(tool.tool);
        }
      });

      return project;
    });

    res.status(200).json(projectsAndTools);
  } catch (err) {
    res
      .status(500)
      .json({ message: "There was an issue loading the projects" });
  }
});

app.post(
  "/api/mail",
  validateRecaptcha,
  validateSchema(emailSchema),
  async (req, res) => {
    const name = req.body.name;
    const email = req.body.email;
    const message = req.body.message;

    try {
      // Retrieve and decrypt credentials
      const data = await Data.find({
        for: { $in: ["ClientID", "ClientSecret"] },
      });
      const { clientID, clientSecret } = {
        clientID: data.find((item) => item.for === "ClientID"),
        clientSecret: data.find((item) => item.for === "ClientSecret"),
      };

      const [clientIDKeyDecrypted, clientSecretKeyDecrypted] =
        await Promise.all([
          decrypt(clientID.for, clientID.key),
          decrypt(clientSecret.for, clientSecret.key),
        ]);

      if (!clientIDKeyDecrypted || !clientSecretKeyDecrypted) {
        throw new Error("Unable to retrieve necessary credentials");
      }

      const oauth2Client = new google.auth.OAuth2(
        clientIDKeyDecrypted,
        clientSecretKeyDecrypted,
        process.env.REDIRECT_URI
      );

      oauth2Client.setCredentials({
        refresh_token: process.env.REFRESH_TOKEN,
      });

      const accessToken = await oauth2Client.getAccessToken();

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          type: "OAuth2",
          user: process.env.EMAIL,
          accessToken: accessToken.token,
          clientId: clientIDKeyDecrypted,
          clientSecret: clientSecretKeyDecrypted,
          refreshToken: process.env.REFRESH_TOKEN,
        },
      });

      const mailOptions = {
        from: email,
        to: process.env.EMAIL,
        subject: `${name} ${email} - Portfolio`,
        text: message,
      };

      const mailOptionsConfirmation = {
        from: process.env.EMAIL,
        to: email,
        subject: "Gavin Oiamo - Confirmation",
        text: "Thank you for reaching out! This is just to confirm that I received your email. I will get back to you as soon as possible. \n \n - Gavin",
      };

      await Promise.all([
        transporter.sendMail(mailOptions),
        transporter.sendMail(mailOptionsConfirmation),
      ]);

      res.status(200).json({ message: "Email successfully sent" });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ message: "An error occurred" });
    }
  }
);

// Route 1: Get all topics
app.get("/api/notes", (req, res) => {
  try {
    const topics = fs
      .readdirSync(notesDirectory)
      .filter((dir) =>
        fs.lstatSync(path.join(notesDirectory, dir)).isDirectory()
      );

    const posts = {};
    topics.forEach((topic) => {
      const postsInTopic = fs
        .readdirSync(path.join(notesDirectory, topic))
        .filter((file) => file.endsWith(".html"));

      posts[topic] = postsInTopic;
    });

    res.status(200).json(posts);
  } catch (err) {
    res.status(500).json({ error: "Unable to fetch topics" });
  }
});

// Route 2: Get posts in a topic
app.get("/api/notes/:topic", (req, res) => {
  const topic = req.params.topic;
  const topicPath = path.join(notesDirectory, topic);

  try {
    const files = fs.readdirSync(topicPath);
    const posts = files.filter(
      (file) => file !== "index.html" && file.endsWith(".html")
    );
    const intro = files.includes("index.html")
      ? fs.readFileSync(path.join(topicPath, "index.html"), "utf-8")
      : null;

    res.status(200).json({ intro, posts });
  } catch (err) {
    res.status(404).json({ error: `Topic '${topic}' not found` });
  }
});

// Route 3: Get a specific post
app.get("/api/notes/:topic/:post", (req, res) => {
  const { topic, post } = req.params;
  const postPath = path.join(notesDirectory, topic, `${post}.html`);

  try {
    if (!fs.existsSync(postPath)) {
      return res
        .status(404)
        .json({ error: `Post '${post}' not found in topic '${topic}'` });
    }
    const content = fs.readFileSync(postPath, "utf-8");
    res.status(200).json({ content });
  } catch (err) {
    res.status(500).json({ error: "Unable to fetch post" });
  }
});

app.listen(process.env.PORT, () => {
  console.log("Server is listening");
});
