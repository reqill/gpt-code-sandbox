const express = require("express");
const { getParameters } = require("codesandbox/lib/api/define");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");

const app = express();
const PORT = process.env.PORT || 8080;
const MAX_FILES = 42;
const CODE_SANDBOX_API = "https://codesandbox.io/api/v1/sandboxes/define";
const CODE_SANBOX_BY_ID = "https://codesandbox.io/s";

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
    },
  })
);

app.use(cors());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again in 15 minutes",
});

app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const swaggerDocument = YAML.load(__dirname + "/openapi.yaml");
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get("/", (req, res) => {
  res.send("This API handles POST requests only");
});

app.post("/", async (req, res) => {
  const { name, dependencies, files } = req.body;

  if (Object.keys(files).length === 0) {
    res.status(400).send("No files provided");
    return;
  }

  if (Object.keys(files).length > MAX_FILES) {
    res.status(400).send("Too many files provided");
    return;
  }

  if (typeof name !== "string") {
    res.status(400).send("Invalid name");
    return;
  }

  if (typeof dependencies !== "object") {
    res.status(400).send("Invalid dependencies");
    return;
  }

  const filesForSandbox = {
    "package.json": { content: { name, dependencies } },
    ...files,
  };

  const params = getParameters({ files: filesForSandbox });

  const form = new FormData();
  form.append("parameters", params);

  const sandboxResponse = await fetch(`${CODE_SANDBOX_API}?json=1`, {
    method: "POST",
    body: form,
  });

  const { sandbox_id } = await sandboxResponse.json();
  const codeSandboxUrl = `${CODE_SANBOX_BY_ID}/${sandbox_id}`;

  res.status(200).send(codeSandboxUrl);
});

if (process.env.DEV === "true" && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
