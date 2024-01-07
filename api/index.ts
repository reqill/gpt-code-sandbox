import express from "express";
import { getParameters } from "codesandbox/lib/api/define";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";

const app = express(),
  PORT = 8080,
  MAX_FILES = 42,
  CODE_SANDBOX_API = "https://codesandbox.io/api/v1/sandboxes/define",
  CODE_SANBOX_BY_ID = "https://codesandbox.io/s";

if (!process.env.VERCEL) {
  app.listen(process.env.PORT || PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

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

type GeneralPostPayload = {
  name: string;
  dependencies: { [key: string]: string };
  files: {
    [key: string]: {
      content: string;
      isBinary?: boolean;
    };
  };
};

app.get("/", (req, res) => {
  res.send("This API handles POST requests only");
});

app.post<{}, {}, GeneralPostPayload>("/", async (req, res) => {
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

  const filesForSandbox: any = {
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

  const { sandbox_id } = (await sandboxResponse.json()) as {
    sandbox_id: string;
  };
  const codeSandboxUrl = `${CODE_SANBOX_BY_ID}/${sandbox_id}`;

  res.status(200).send(codeSandboxUrl);
});

export default app;
