require("dotenv").config();
const express = require("express");
const cloudinary = require("cloudinary").v2;
const fse = require("fs-extra");
const app = express();
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const cloudinaryConfig = cloudinary.config({
  cloud_name: process.env.CLOUDNAME,
  api_key: process.env.CLOUDAPIKEY,
  api_secret: process.env.CLOUDINARYSECRET,
  secure: true,
});

function passwordProtected(req, res, next) {
  res.set("WWW-Authenticate", "Basic realm='Cloudinary Front-end Upload'");
  if (req.headers.authorization == "Basic YWRtaW46YWRtaW4=") {
    next();
  } else {
    res.status(401).send("Try again");
  }
}

app.use(passwordProtected);

app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
    <style>
      body {
        font-family: 'Arial', sans-serif;
       background: linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%);
        color: #333;
        margin: 0;
        padding: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        flex-direction: column;
      }

      h1 {
        color: #ffffff;
        background-color: rgba(0, 0, 0, 0.5);
        padding: 10px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      }

      form {
        background-color: #ffffff;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        width: 320px;
        text-align: center;
        margin-top: 20px;
      }

      input[type="file"] {
        display: block;
        margin: 20px auto;
        padding: 10px;
        border: 2px dashed #ddd;
        border-radius: 4px;
        width: 90%;
        box-sizing: border-box;
        transition: border-color 0.3s ease;
      }

      input[type="file"]:hover {
        border-color: #4a90e2;
      }

      button {
        background-color: #ff6f61;
        color: #ffffff;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.3s ease;
      }

      button:hover {
        background-color: #ff4a39;
      }

      hr {
        margin: 40px 0;
        border: 0;
        border-top: 1px solid #ddd;
        width: 80%;
      }

      a {
        color: #ff6f61;
        text-decoration: none;
        transition: color 0.3s ease;
        font-weight: bold;
      }

      a:hover {
        color: #ff4a39;
      }
    </style>
  </head>
  <body>
    <h1>Welcome</h1>

    <form id="upload-form">
      <input id="file-field" type="file" />
      <button>Upload</button>
    </form>

    <hr />

    <!--<a href="/view-photos">How would I use the public_id values that I store in my database?</a>-->

    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    <script src="/client-side.js"></script>
  </body>
</html>
`);
});

app.get("/get-signature", (req, res) => {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp: timestamp,
    },
    cloudinaryConfig.api_secret
  );
  res.json({ timestamp, signature });
});

app.post("/do-something-with-photo", async (req, res) => {
  // based on the public_id and the version that the (potentially malicious) user is submitting...
  // we can combine those values along with our SECRET key to see what we would expect the signature to be if it was innocent / valid / actually coming from Cloudinary
  const expectedSignature = cloudinary.utils.api_sign_request(
    { public_id: req.body.public_id, version: req.body.version },
    cloudinaryConfig.api_secret
  );

  // We can trust the visitor's data if their signature is what we'd expect it to be...
  // Because without the SECRET key there's no way for someone to know what the signature should be...
  if (expectedSignature === req.body.signature) {
    // Do whatever you need to do with the public_id for the photo
    // Store it in a database or pass it to another service etc...
    await fse.ensureFile("./data.txt");
    const existingData = await fse.readFile("./data.txt", "utf8");
    await fse.outputFile(
      "./data.txt",
      existingData + req.body.public_id + "\n"
    );
  }
});

app.get("/view-photos", async (req, res) => {
  await fse.ensureFile("./data.txt");
  const existingData = await fse.readFile("./data.txt", "utf8");
  res.send(`<h1>Hello, here are a few photos...</h1>
  <ul>
  ${existingData
    .split("\n")
    .filter((item) => item)
    .map((id) => {
      return `<li><img src="https://res.cloudinary.com/${cloudinaryConfig.cloud_name}/image/upload/w_200,h_100,c_fill,q_100/${id}.jpg">
      <form action="delete-photo" method="POST">
        <input type="hidden" name="id" value="${id}" />
        <button>Delete</button>
      </form>
      </li>
      `;
    })
    .join("")}
  </ul>
  <p><a href="/">Back to homepage</a></p>
  `);
});

app.post("/delete-photo", async (req, res) => {
  // do whatever you need to do in your database etc...
  await fse.ensureFile("./data.txt");
  const existingData = await fse.readFile("./data.txt", "utf8");
  await fse.outputFile(
    "./data.txt",
    existingData
      .split("\n")
      .filter((id) => id != req.body.id)
      .join("\n")
  );

  // actually delete the photo from cloudinary
  cloudinary.uploader.destroy(req.body.id);

  res.redirect("/view-photos");
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
