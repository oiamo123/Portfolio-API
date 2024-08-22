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

app.post("/api/resume", validateRecaptcha, async (req, res) => {
  try {
    const images = await Images.find({ for: "resume" }).lean();

    if (!images) {
      res
        .status(400)
        .json({ message: "There was an issue retrieving the images" });
    }

    res.status(200).json(images);
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

    const data = await Data.find({
      for: { $in: ["ClientID", "ClientSecret", "RefreshToken"] },
    });

    const { clientID, clientSecret, refreshToken } = {
      clientID: data.find((item) => item.for === "ClientID"),
      clientSecret: data.find((item) => item.for === "ClientSecret"),
      refreshToken: data.find((item) => item.for === "RefreshToken"),
    };

    const [
      clientIDKeydecrypted,
      clientSecretKeyDecrypted,
      refreshTokenKeyDecrypted,
    ] = await Promise.all([
      decrypt(clientID.for, clientID.key),
      decrypt(clientSecret.for, clientSecret.key),
      decrypt(refreshToken.for, refreshToken.key),
    ]);

    if (
      !clientIDKeydecrypted ||
      !clientSecretKeyDecrypted ||
      !refreshTokenKeyDecrypted
    ) {
      throw new Error("Unable to retrieve necessary credentials");
    }

    try {
      const oauth2Client = await new google.auth.OAuth2(
        clientIDKeydecrypted,
        clientSecretKeyDecrypted,
        process.env.REDIRECT_URI
      );

      await oauth2Client.setCredentials({
        refresh_token: refreshTokenKeyDecrypted,
      });

      const accessToken = await oauth2Client
        .getRequestHeaders()
        .then((headers) => headers["Authorization"].split(" ")[1]);

      const transporter = await nodemailer.createTransport({
        service: "gmail",
        auth: {
          type: "OAuth2",
          user: process.env.EMAIL,
          accessToken: accessToken,
          clientId: clientIDKeydecrypted,
          clientSecret: clientSecretKeyDecrypted,
          refreshToken: refreshTokenKeyDecrypted,
        },
      });

      const mailOptions = {
        from: `${email}`,
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

      await transporter.sendMail(mailOptions);
      await transporter.sendMail(mailOptionsConfirmation);

      res.status(200).json({ message: "Email successfully sent" });
    } catch (error) {
      res.status(500).json({ message: "An error occurred" });
    }
  }
);

app.listen(process.env.PORT, () => {
  console.log("Server is listening");
});
